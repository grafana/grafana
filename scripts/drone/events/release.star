"""
This module returns all the pipelines used in the event of a release along with supporting functions.
"""

load(
    "scripts/drone/services/services.star",
    "integration_test_services",
    "integration_test_services_volumes",
)
load(
    "scripts/drone/steps/github.star",
    "github_app_generate_token_step",
    "github_app_pipeline_volumes",
    "github_app_step_volumes",
)
load(
    "scripts/drone/steps/lib.star",
    "compile_build_cmd",
    "download_grabpl_step",
    "identify_runner_step",
    "memcached_integration_tests_steps",
    "mysql_integration_tests_steps",
    "postgres_integration_tests_steps",
    "publish_grafanacom_step",
    "publish_linux_packages_step",
    "redis_integration_tests_steps",
    "remote_alertmanager_integration_tests_steps",
    "verify_gen_cue_step",
    "verify_gen_jsonnet_step",
    "verify_grafanacom_step",
    "wire_install_step",
    "yarn_install_step",
)
load(
    "scripts/drone/utils/images.star",
    "images",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)
load(
    "scripts/drone/vault.star",
    "from_secret",
    "gcp_grafanauploads_base64",
    "npm_token",
    "prerelease_bucket",
    "rgm_gcp_key_base64",
)

ver_mode = "release"
semver_regex = r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"

def retrieve_npm_packages_step():
    return {
        "name": "retrieve-npm-packages",
        "image": images["publish"],
        "depends_on": [
            "compile-build-cmd",
            "yarn-install",
        ],
        "failure": "ignore",
        "environment": {
            "GCP_KEY": from_secret(gcp_grafanauploads_base64),
            "PRERELEASE_BUCKET": from_secret(prerelease_bucket),
        },
        "commands": ["./bin/build artifacts npm retrieve --tag ${DRONE_TAG}"],
    }

def release_pr_step(depends_on = []):
    return {
        "name": "create-release-pr",
        "image": images["curl"],
        "depends_on": depends_on,
        "environment": {
            "GH_CLI_URL": "https://github.com/cli/cli/releases/download/v2.50.0/gh_2.50.0_linux_amd64.tar.gz",
        },
        "commands": [
            "export GITHUB_TOKEN=$(cat /github-app/token)",
            "apk add perl",
            "v_target=`echo $${{TAG}} | perl -pe 's/{}/v\\1.\\2.x/'`".format(semver_regex),
            # Install gh CLI
            "curl -L $${GH_CLI_URL} | tar -xz --strip-components=1 -C /usr",
            # Run the release-pr workflow
            "gh workflow run " +
            "-f dry_run=$${DRY_RUN} " +
            "-f version=$${TAG} " +
            # If the submitter has set a target branch, then use that, otherwise use the default
            "-f target=$${v_target} " +
            "-f latest=$${LATEST} " +
            "--repo=grafana/grafana release-pr.yml",
        ],
        "volumes": github_app_step_volumes(),
    }

def release_npm_packages_step():
    return {
        "name": "release-npm-packages",
        "image": images["node"],
        "depends_on": [
            "compile-build-cmd",
            "retrieve-npm-packages",
        ],
        "failure": "ignore",
        "environment": {
            "NPM_TOKEN": from_secret(npm_token),
        },
        "commands": ["./bin/build artifacts npm release --tag ${DRONE_TAG}"],
    }

def publish_artifacts_step():
    return {
        "name": "publish-artifacts",
        "image": images["publish"],
        "environment": {
            "GCP_KEY": from_secret(gcp_grafanauploads_base64),
            "PRERELEASE_BUCKET": from_secret("prerelease_bucket"),
        },
        "commands": [
            "./bin/build artifacts packages --artifacts-editions=oss --tag $${DRONE_TAG} --src-bucket $${PRERELEASE_BUCKET}",
        ],
        "depends_on": ["compile-build-cmd"],
    }

def publish_storybook_step():
    return {
        "name": "publish-storybook",
        "image": images["publish"],
        "environment": {
            "GCP_KEY": from_secret(gcp_grafanauploads_base64),
            "PRERELEASE_BUCKET": from_secret("prerelease_bucket"),
        },
        "commands": [
            "./bin/build artifacts storybook --tag ${DRONE_TAG}",
        ],
        "depends_on": ["compile-build-cmd"],
    }

def publish_artifacts_pipelines(mode):
    """Published artifacts after they've been stored and tested in prerelease buckets.

    Args:
      mode: public or security.
        Defaults to ''.

    Returns:
      List of Drone pipelines.
    """
    trigger = {
        "event": ["promote"],
        "target": [mode],
    }
    steps = [
        compile_build_cmd(),
        publish_artifacts_step(),
        publish_storybook_step(),
        github_app_generate_token_step(),
        release_pr_step(depends_on = ["publish-artifacts", github_app_generate_token_step()["name"]]),
    ]

    return [
        pipeline(
            name = "create-release-pr",
            trigger = {
                "event": ["promote"],
                "target": "release-pr",
            },
            steps = [
                release_pr_step(),
            ],
            volumes = github_app_pipeline_volumes(),
        ),
        pipeline(
            name = "publish-artifacts-{}".format(mode),
            trigger = trigger,
            steps = steps,
            environment = {"EDITION": "oss"},
            volumes = github_app_pipeline_volumes(),
        ),
    ]

def publish_packages_pipeline():
    """Generates pipelines used for publishing packages for OSS.

    Returns:
      List of Drone pipelines. One for each of OSS and enterprise packages.
    """

    trigger = {
        "event": ["promote"],
        "target": ["public"],
    }
    oss_steps = [
        compile_build_cmd(),
        publish_linux_packages_step(package_manager = "deb"),
        publish_linux_packages_step(package_manager = "rpm"),
        publish_grafanacom_step(ver_mode = "release"),
        verify_grafanacom_step(),
    ]

    deps = [
        "publish-artifacts-public",
        "publish-docker-public",
    ]

    return [
        pipeline(
            name = "verify-grafanacom-artifacts",
            trigger = {
                "event": ["promote"],
                "target": "verify-grafanacom-artifacts",
            },
            steps = [
                verify_grafanacom_step(depends_on = []),
            ],
        ),
        pipeline(
            name = "publish-packages",
            trigger = trigger,
            steps = oss_steps,
            depends_on = deps,
            environment = {"EDITION": "oss"},
        ),
        pipeline(
            name = "publish-grafanacom",
            trigger = {
                "event": ["promote"],
                "target": "publish-grafanacom",
            },
            steps = [
                compile_build_cmd(),
                publish_grafanacom_step(ver_mode = "release", depends_on = ["compile-build-cmd"]),
            ],
        ),
    ]

def publish_npm_pipelines():
    trigger = {
        "event": ["promote"],
        "target": ["public"],
    }
    steps = [
        compile_build_cmd(),
        yarn_install_step(),
        retrieve_npm_packages_step(),
        release_npm_packages_step(),
    ]

    return [
        pipeline(
            name = "publish-npm-packages-public",
            trigger = trigger,
            steps = steps,
            environment = {"EDITION": "oss"},
        ),
    ]

def integration_test_pipelines():
    """
    Trigger integration tests on release builds

    These pipelines should be triggered when we have a release that does a lot of
    cherry-picking and we still want to have all the integration tests run on that
    particular build.

    Returns:
      List of Drone pipelines
    """
    trigger = {
        "event": ["promote"],
        "target": "integration-tests",
    }
    pipelines = []
    volumes = integration_test_services_volumes()
    integration_test_steps = postgres_integration_tests_steps() + \
                             mysql_integration_tests_steps("mysql80", "8.0") + \
                             redis_integration_tests_steps() + \
                             memcached_integration_tests_steps() + \
                             remote_alertmanager_integration_tests_steps()

    pipelines.append(pipeline(
        name = "integration-tests",
        trigger = trigger,
        services = integration_test_services(),
        steps = [
                    download_grabpl_step(),
                    identify_runner_step(),
                    verify_gen_cue_step(),
                    verify_gen_jsonnet_step(),
                    wire_install_step(),
                ] +
                integration_test_steps,
        environment = {"EDITION": "oss"},
        volumes = volumes,
    ))

    return pipelines

def verify_release_pipeline(
        name = "verify-prerelease-assets",
        bucket = from_secret(prerelease_bucket),
        gcp_key = from_secret(rgm_gcp_key_base64),
        version = "${DRONE_TAG}",
        trigger = {},
        depends_on = [
            "release-build-e2e-publish",
        ]):
    """
    Runs a script that 'gsutil stat's every artifact that should have been produced by the pre-release process.

    Returns:
      A single Drone pipeline that runs the script.
    """
    step = {
        "name": "gsutil-stat",
        "depends_on": ["clone"],
        "image": images["cloudsdk"],
        "environment": {
            "BUCKET": bucket,
            "GCP_KEY": gcp_key,
        },
        "commands": [
            "apt-get update && apt-get install -yq gettext",
            "printenv GCP_KEY | base64 -d > /tmp/key.json",
            "gcloud auth activate-service-account --key-file=/tmp/key.json",
            "./scripts/list-release-artifacts.sh {} | xargs -n1 gsutil stat >> /tmp/stat.log".format(version),
            "! cat /tmp/stat.log | grep \"No URLs matched\"",
        ],
    }
    return pipeline(
        depends_on = depends_on,
        name = name,
        trigger = trigger,
        steps = [step],
    )
