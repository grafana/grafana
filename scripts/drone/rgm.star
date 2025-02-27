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
    "scripts/drone/steps/github.star",
    "github_app_generate_token_step",
    "github_app_pipeline_volumes",
    "github_app_step_volumes",
)
load(
    "scripts/drone/utils/images.star",
    "images",
)
load(
    "scripts/drone/utils/utils.star",
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
    "npm_token",
    "rgm_cdn_destination",
    "rgm_dagger_token",
    "rgm_destination",
    "rgm_downloads_destination",
    "rgm_gcp_key_base64",
    "rgm_storybook_destination",
)

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

main_trigger = {
    "event": [
        "push",
    ],
    "branch": "main",
    "paths": docs_paths,
    "repo": [
        "grafana/grafana",
    ],
}

nightly_trigger = {
    "event": {
        "include": [
            "cron",
        ],
    },
    "cron": {
        "include": [
            "nightly-release",
        ],
    },
}

version_branch_trigger = {"ref": ["refs/heads/v[0-9]*"]}

def rgm_env_secrets(env):
    """Adds the rgm secret ENV variables to the given env arg

    Args:
      env: A map of environment varables. This function will adds the necessary secrets to it (and potentially overwrite them).
    Returns:
        Drone step.
    """
    env["DESTINATION"] = from_secret(rgm_destination)
    env["STORYBOOK_DESTINATION"] = from_secret(rgm_storybook_destination)
    env["CDN_DESTINATION"] = from_secret(rgm_cdn_destination)
    env["DOWNLOADS_DESTINATION"] = from_secret(rgm_downloads_destination)

    env["GCP_KEY_BASE64"] = from_secret(rgm_gcp_key_base64)
    env["_EXPERIMENTAL_DAGGER_CLOUD_TOKEN"] = from_secret(rgm_dagger_token)
    env["GPG_PRIVATE_KEY"] = from_secret("packages_gpg_private_key")
    env["GPG_PUBLIC_KEY"] = from_secret("packages_gpg_public_key")
    env["GPG_PASSPHRASE"] = from_secret("packages_gpg_passphrase")
    env["DOCKER_USERNAME"] = from_secret("docker_username")
    env["DOCKER_PASSWORD"] = from_secret("docker_password")
    env["NPM_TOKEN"] = from_secret(npm_token)
    env["GCOM_API_KEY"] = from_secret("grafana_api_key")
    return env

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
        "ALPINE_BASE": images["alpine"],
        "UBUNTU_BASE": images["ubuntu"],
    }
    rgm_run_step = {
        "name": name,
        "image": "grafana/grafana-build:main",
        "pull": "always",
        "commands": [
            "export GRAFANA_DIR=$$(pwd)",
            "export GITHUB_TOKEN=$(cat /github-app/token)",
            "cd /src && ./scripts/{}".format(script),
        ],
        "environment": rgm_env_secrets(env),
        # The docker socket is a requirement for running dagger programs
        # In the future we should find a way to use dagger without mounting the docker socket.
        "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}] + github_app_step_volumes(),
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
      Drone step.
    """
    commands = [
        "printenv GCP_KEY_BASE64 | base64 -d > /tmp/key.json",
        "gcloud auth activate-service-account --key-file=/tmp/key.json",
        "gcloud storage cp -r {} {}".format(src, dst),
    ]

    return {
        "name": "rgm-copy",
        "image": "google/cloud-sdk:alpine",
        "commands": commands,
        "environment": rgm_env_secrets({}),
    }

def rgm_publish_packages(bucket = "grafana-packages"):
    """Publish deb and rpm packages.

    Args:
      bucket: target bucket to publish the packages.

    Returns:
      Drone steps.
    """
    steps = []
    for package_manager in ["deb", "rpm"]:
        steps.append({
            "name": "publish-{}".format(package_manager),
            # See https://github.com/grafana/deployment_tools/blob/master/docker/package-publish/README.md for docs on that image
            "image": images["package_publish"],
            "privileged": True,
            "settings": {
                "access_key_id": from_secret("packages_access_key_id"),
                "secret_access_key": from_secret("packages_secret_access_key"),
                "service_account_json": from_secret("packages_service_account"),
                "target_bucket": bucket,
                "gpg_passphrase": from_secret("packages_gpg_passphrase"),
                "gpg_public_key": from_secret("packages_gpg_public_key"),
                "gpg_private_key": from_secret("packages_gpg_private_key"),
                "package_path": "file:///drone/src/dist/*.{}".format(package_manager),
            },
        })

    return steps

def rgm_main():
    # Runs a package / build process (with some distros) when commits are merged to main
    return pipeline(
        name = "rgm-main-prerelease",
        trigger = main_trigger,
        steps = rgm_run("rgm-build", "drone_build_main.sh"),
        depends_on = ["main-test-backend", "main-test-frontend"],
    )

def rgm_tag():
    # Runs a package / build process (with all distros) when a tag is made
    return pipeline(
        name = "rgm-tag-prerelease",
        trigger = tag_trigger,
        steps = rgm_run("rgm-build", "drone_build_tag_grafana.sh"),
    )

def rgm_version_branch():
    # Runs a package / build proces (with all distros) when a commit lands on a version branch
    return pipeline(
        name = "rgm-version-branch-prerelease",
        trigger = version_branch_trigger,
        steps = rgm_run("rgm-build", "drone_build_tag_grafana.sh"),
    )

def rgm_nightly_build():
    """Nightly build pipeline.

    Returns:
      Drone pipeline.
    """
    src = "$${DRONE_WORKSPACE}/dist/*"
    dst = "$${DESTINATION}/$${DRONE_BUILD_EVENT}"
    copy_step = rgm_copy(src, dst)
    if not dst.startswith("gs://"):
        copy_step["commands"].insert(0, "mkdir -p {}".format(dst))

    copy_steps = with_deps([copy_step], ["rgm-build"])

    return pipeline(
        name = "rgm-nightly-build",
        trigger = nightly_trigger,
        steps = rgm_run("rgm-build", "drone_build_nightly_grafana.sh") + copy_steps,
        depends_on = ["nightly-test-backend", "nightly-test-frontend"],
    )

def rgm_nightly_publish():
    """Nightly publish pipeline.

    Returns:
      Drone pipeline.
    """
    src = "$${DESTINATION}/$${DRONE_BUILD_EVENT}/*_$${DRONE_BUILD_NUMBER}_*"
    dst = "$${DRONE_WORKSPACE}/dist"

    publish_steps = with_deps(rgm_run("rgm-publish", "drone_publish_nightly_grafana.sh"), ["rgm-copy"])
    package_steps = with_deps(rgm_publish_packages(), ["rgm-publish"])
    copy_step = rgm_copy(src, dst)
    if not dst.startswith("gs://"):
        copy_step["commands"].insert(0, "mkdir -p {}".format(dst))
    return pipeline(
        name = "rgm-nightly-publish",
        trigger = nightly_trigger,
        steps = [copy_step] + publish_steps + package_steps,
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
    build = rgm_tag()

    return [
        build,
        verify_release_pipeline(
            trigger = tag_trigger,
            name = "rgm-tag-verify-prerelease-assets",
            bucket = "grafana-prerelease",
            depends_on = [
                build["name"],
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

def rgm_promotion_pipeline():
    """Promotion build pipeline.

    Returns:
      Drone pipeline.
    """
    promotion_trigger = {
        "event": ["promote"],
        "target": "upload-packages",
    }

    env = {
        "GO_VERSION": golang_version,
        "ALPINE_BASE": images["alpine"],
        "UBUNTU_BASE": images["ubuntu"],
    }

    # Expected promotion args:
    # * GRAFANA_REF = commit hash, branch name, or tag name
    # * ENTERPRISE_REF = commit hash, branch name, or tag name. If not building an enterprise artifact, then this can be
    #   left empty.
    # * ARTIFACTS = comma delimited list of artifacts (ex: "targz:grafana:linux/amd64,rpm:grafana:linux/amd64")
    # * VERSION = version string of Grafana that is being built (ex: v10.0.0)
    # * UPLOAD_TO = Google Cloud Storage URL to upload the built artifacts to. (ex: gs://some-bucket/path)
    build_step = {
        "name": "rgm-build",
        "image": "grafana/grafana-build:main",
        "pull": "always",
        "commands": [
            "export GITHUB_TOKEN=$(cat /github-app/token)",
            "dagger run --silent /src/grafana-build artifacts " +
            "-a $${ARTIFACTS} " +
            "--grafana-ref=$${GRAFANA_REF} " +
            "--enterprise-ref=$${ENTERPRISE_REF} " +
            "--grafana-repo=$${GRAFANA_REPO} " +
            "--version=$${VERSION} " +
            "--go-version={}".format(golang_version),
        ],
        "environment": rgm_env_secrets(env),
        # The docker socket is a requirement for running dagger programs
        # In the future we should find a way to use dagger without mounting the docker socket.
        "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}] + github_app_step_volumes(),
    }

    generate_token_step = github_app_generate_token_step()
    publish_step = rgm_copy("dist/*", "$${UPLOAD_TO}")
    build_step["depends_on"] = [
        generate_token_step["name"],
    ]

    publish_step["depends_on"] = [
        build_step["name"],
    ]

    steps = [
        generate_token_step,
        build_step,
        publish_step,
    ]

    return [
        pipeline(
            name = "rgm-promotion",
            trigger = promotion_trigger,
            steps = steps,
            volumes = github_app_step_volumes() + github_app_pipeline_volumes(),
        ),
    ]

def rgm():
    return (
        rgm_main_pipeline() +
        rgm_tag_pipeline() +
        rgm_version_branch_pipeline() +
        rgm_nightly_pipeline() +
        rgm_promotion_pipeline()
    )
