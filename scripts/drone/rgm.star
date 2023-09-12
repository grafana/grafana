"""
rgm uses 'github.com/grafana/grafana-build' to build Grafana on the following events:
* A merge to main
* A tag that begins with a 'v'
"""

load(
    "scripts/drone/events/release.star",
    "verify_release_pipeline",
)
load(
    "scripts/drone/pipelines/test_backend.star",
    "test_backend",
)
load(
    "scripts/drone/pipelines/test_frontend.star",
    "test_frontend",
)
load(
    "scripts/drone/pipelines/whats_new_checker.star",
    "whats_new_checker_pipeline",
)
load(
    "scripts/drone/steps/lib_windows.star",
    "get_windows_steps",
)
load(
    "scripts/drone/utils/utils.star",
    "ignore_failure",
    "pipeline",
    "with_deps",
)
load(
    "scripts/drone/variables.star",
    "golang_version",
)
load(
    "scripts/drone/vault.star",
    "from_secret",
    "rgm_dagger_token",
    "rgm_destination",
    "rgm_gcp_key_base64",
    "rgm_github_token",
)

def rgm_env_secrets(env):
    """Adds the rgm secret ENV variables to the given env arg

    Args:
      env: A map of environment varables. This function will adds the necessary secrets to it (and potentially overwrite them).
    Returns:
        Drone step.
    """
    env["GCP_KEY_BASE64"] = from_secret(rgm_gcp_key_base64)
    env["DESTINATION"] = from_secret(rgm_destination)
    env["GITHUB_TOKEN"] = from_secret(rgm_github_token)
    env["_EXPERIMENTAL_DAGGER_CLOUD_TOKEN"] = from_secret(rgm_dagger_token)
    env["GPG_PRIVATE_KEY"] = from_secret("packages_gpg_private_key")
    env["GPG_PUBLIC_KEY"] = from_secret("packages_gpg_public_key")
    env["GPG_PASSPHRASE"] = from_secret("packages_gpg_passphrase")
    env["DOCKER_USERNAME"] = from_secret("docker_username")
    env["DOCKER_PASSWORD"] = from_secret("docker_password")
    return env

docs_paths = {
    "exclude": [
        "*.md",
        "docs/**",
        "packages/**/*.md",
        "latest.json",
    ],
}

tag_trigger = {
    "event": {
        "exclude": [
            "promote",
        ],
    },
    "ref": {
        "include": [
            "refs/tags/v*",
        ],
        "exclude": [
            "refs/tags/*-cloud*",
        ],
    },
}

nightly_trigger = {
    "event": {
        "include": [
            "promote",
            # "cron",
        ],
    },
    "target": {
        "include": [
            "nightly",
        ],
    },
    # "cron": {
    #     "include": [
    #         "nightly-release",
    #     ],
    # },
}

version_branch_trigger = {"ref": ["refs/heads/v[0-9]*"]}

def rgm_run(name, script):
    """Returns a pipeline that does a full build & package of Grafana.

    Args:
      name: The name of the pipeline step.
      script: The script in the container to run.
    Returns:
        Drone step.
    """
    env = {
        "GO_VERSION": golang_version,
    }
    rgm_run_step = {
        "name": name,
        "image": "grafana/grafana-build:dev-7a93728",
        "pull": "always",
        "commands": [
            "export GRAFANA_DIR=$$(pwd)",
            "cd /src && ./scripts/{}".format(script),
        ],
        "environment": rgm_env_secrets(env),
        # The docker socket is a requirement for running dagger programs
        # In the future we should find a way to use dagger without mounting the docker socket.
        "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}],
    }

    return [
        rgm_run_step,
    ]

def rgm_copy(src, dst):
    """Copies file from/to GCS.

    Args:
      src: source of the files.
      dst: destination of the files.

    Returns:
      Drone steps.
    """
    commands = [
        "printenv GCP_KEY_BASE64 | base64 -d > /tmp/key.json",
        "gcloud auth activate-service-account --key-file=/tmp/key.json",
        "gcloud storage cp -r {} {}".format(src, dst),
    ]

    if not dst.startswith("gs://"):
        commands.insert(0, "mkdir -p {}".format(dst))

    rgm_copy_step = {
        "name": "rgm-copy",
        "image": "google/cloud-sdk:alpine",
        "commands": commands,
        "environment": rgm_env_secrets({}),
    }

    return [
        rgm_copy_step,
    ]

def rgm_main():
    # Runs a package / build process (with some distros) when commits are merged to main
    trigger = {
        "event": [
            "push",
        ],
        "branch": "main",
        "paths": docs_paths,
        "repo": [
            "grafana/grafana",
        ],
    }

    return pipeline(
        name = "rgm-main-prerelease",
        trigger = trigger,
        steps = rgm_run("rgm-build", "drone_publish_main.sh"),
        depends_on = ["main-test-backend", "main-test-frontend"],
    )

def rgm_tag():
    # Runs a package / build process (with all distros) when a tag is made
    return pipeline(
        name = "rgm-tag-prerelease",
        trigger = tag_trigger,
        steps = rgm_run("rgm-build", "drone_publish_tag_grafana.sh"),
        depends_on = ["release-test-backend", "release-test-frontend"],
    )

def rgm_tag_windows():
    return pipeline(
        name = "rgm-tag-prerelease-windows",
        trigger = tag_trigger,
        steps = ignore_failure(
            get_windows_steps(
                ver_mode = "release",
                bucket = "grafana-prerelease",
            ),
        ),
        depends_on = ["rgm-tag-prerelease"],
        platform = "windows",
    )

def rgm_version_branch():
    # Runs a package / build proces (with all distros) when a commit lands on a version branch
    return pipeline(
        name = "rgm-version-branch-prerelease",
        trigger = version_branch_trigger,
        steps = rgm_run("rgm-build", "drone_publish_tag_grafana.sh"),
        depends_on = ["release-test-backend", "release-test-frontend"],
    )

def rgm_nightly_build():
    src = "$${DRONE_WORKSPACE}/dist"
    dst = "$${DESTINATION}/$${DRONE_BUILD_EVENT}"

    copy_steps = with_deps(rgm_copy(src, dst), ["rgm-build"])

    return pipeline(
        name = "rgm-nightly-build",
        trigger = nightly_trigger,
        steps = rgm_run("rgm-build", "drone_build_nightly_grafana.sh") + copy_steps,
        depends_on = ["nightly-test-backend", "nightly-test-frontend"],
    )

def rgm_nightly_publish():
    src = "$${DESTINATION}/$${DRONE_BUILD_EVENT}/*$${DRONE_BUILD_ID}*"
    dst = "$${DRONE_WORKSPACE}/dist"

    publish_steps = with_deps(rgm_run("rgm-publish", "drone_publish_nightly_grafana.sh"), ["rgm-copy"])

    return pipeline(
        name = "rgm-nightly-publish",
        trigger = nightly_trigger,
        steps = rgm_copy(src, dst) + publish_steps,
        depends_on = ["rgm-nightly-build"],
    )

def rgm_nightly_pipeline():
    return [
        test_frontend(nightly_trigger, "nightly"),
        test_backend(nightly_trigger, "nightly"),
        rgm_nightly_build(),
        rgm_nightly_publish(),
    ]

def rgm_tag_pipeline():
    return [
        whats_new_checker_pipeline(tag_trigger),
        test_frontend(tag_trigger, "release"),
        test_backend(tag_trigger, "release"),
        rgm_tag(),
        rgm_tag_windows(),
        verify_release_pipeline(
            trigger = tag_trigger,
            name = "rgm-tag-verify-prerelease-assets",
            bucket = "grafana-prerelease",
            depends_on = [
                "rgm-tag-prerelease",
                "rgm-tag-prerelease-windows",
            ],
        ),
    ]

def rgm_version_branch_pipeline():
    return [
        rgm_version_branch(),
        verify_release_pipeline(
            trigger = version_branch_trigger,
            name = "rgm-prerelease-verify-prerelease-assets",
            bucket = "grafana-prerelease",
            depends_on = [
                "rgm-version-branch-prerelease",
            ],
        ),
    ]

def rgm_main_pipeline():
    return [
        rgm_main(),
    ]

def rgm():
    return (
        rgm_main_pipeline() +
        rgm_tag_pipeline() +
        rgm_version_branch_pipeline() +
        rgm_nightly_pipeline()
    )
