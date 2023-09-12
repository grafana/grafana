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

version_branch_trigger = {"ref": ["refs/heads/v[0-9]*"]}

def rgm_build(script = "drone_publish_main.sh", canFail = True):
    """Returns a pipeline that does a full build & package of Grafana.

    Args:
      script: The script in the container to run.
      canFail: if true, then this pipeline can fail while the entire build will still succeed.
    Returns:
        Drone step.
    """
    env = {
        "GO_VERSION": golang_version,
    }
    rgm_build_step = {
        "name": "rgm-build",
        "image": "grafana/grafana-build:main",
        "commands": [
            "export GRAFANA_DIR=$$(pwd)",
            "cd /src && ./scripts/{}".format(script),
        ],
        "environment": rgm_env_secrets(env),
        # The docker socket is a requirement for running dagger programs
        # In the future we should find a way to use dagger without mounting the docker socket.
        "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}],
    }

    if canFail:
        rgm_build_step["failure"] = "ignore"

    return [
        rgm_build_step,
    ]

def rgm_main():
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
        steps = rgm_build(canFail = True),
        depends_on = ["main-test-backend", "main-test-frontend"],
    )

def rgm_tag():
    return pipeline(
        name = "rgm-tag-prerelease",
        trigger = tag_trigger,
        steps = rgm_build(script = "drone_publish_tag_grafana.sh", canFail = False),
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
    return pipeline(
        name = "rgm-version-branch-prerelease",
        trigger = version_branch_trigger,
        steps = rgm_build(script = "drone_publish_tag_grafana.sh", canFail = False),
        depends_on = ["release-test-backend", "release-test-frontend"],
    )

def rgm():
    return [
        whats_new_checker_pipeline(tag_trigger),
        test_frontend(tag_trigger, "release"),
        test_backend(tag_trigger, "release"),
        rgm_main(),  # Runs a package / build process (with some distros) when commits are merged to main
        rgm_tag(),  # Runs a package / build process (with all distros) when a tag is made
        rgm_tag_windows(),
        rgm_version_branch(),  # Runs a package / build proces (with all distros) when a commit lands on a version branch
        verify_release_pipeline(
            trigger = tag_trigger,
            name = "rgm-tag-verify-prerelease-assets",
            bucket = "grafana-prerelease",
            depends_on = [
                "rgm-tag-prerelease",
                "rgm-tag-prerelease-windows",
            ],
        ),
        verify_release_pipeline(
            trigger = version_branch_trigger,
            name = "rgm-prerelease-verify-prerelease-assets",
            bucket = "grafana-prerelease",
            depends_on = [
                "rgm-version-branch-prerelease",
            ],
        ),
    ]
