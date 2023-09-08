"""
This module returns all the pipelines used in the event of a release along with supporting functions.
"""

load(
    "scripts/drone/steps/lib.star",
    "build_backend_step",
    "build_docker_images_step",
    "build_frontend_package_step",
    "build_frontend_step",
    "build_plugins_step",
    "build_storybook_step",
    "compile_build_cmd",
    "copy_packages_for_docker_step",
    "download_grabpl_step",
    "e2e_tests_artifacts",
    "e2e_tests_step",
    "grafana_server_step",
    "identify_runner_step",
    "memcached_integration_tests_steps",
    "mysql_integration_tests_steps",
    "postgres_integration_tests_steps",
    "publish_grafanacom_step",
    "publish_linux_packages_step",
    "redis_integration_tests_steps",
    "store_storybook_step",
    "trigger_oss",
    "upload_cdn_step",
    "upload_packages_step",
    "verify_gen_cue_step",
    "verify_gen_jsonnet_step",
    "wire_install_step",
    "yarn_install_step",
)
load(
    "scripts/drone/steps/lib_windows.star",
    "get_windows_steps",
)
load(
    "scripts/drone/services/services.star",
    "integration_test_services",
    "integration_test_services_volumes",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)
load(
    "scripts/drone/pipelines/test_frontend.star",
    "test_frontend",
)
load(
    "scripts/drone/pipelines/test_backend.star",
    "test_backend",
)
load(
    "scripts/drone/vault.star",
    "from_secret",
    "gcp_grafanauploads_base64",
    "npm_token",
    "prerelease_bucket",
    "rgm_gcp_key_base64",
)
load(
    "scripts/drone/utils/images.star",
    "images",
)
load(
    "scripts/drone/pipelines/whats_new_checker.star",
    "whats_new_checker_pipeline",
)

ver_mode = "release"

release_trigger = {
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

def release_npm_packages_step():
    return {
        "name": "release-npm-packages",
        "image": images["go"],
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
            "./bin/build artifacts packages --tag $${DRONE_TAG} --src-bucket $${PRERELEASE_BUCKET}",
        ],
        "depends_on": ["compile-build-cmd"],
    }

def publish_static_assets_step():
    return {
        "name": "publish-static-assets",
        "image": images["publish"],
        "environment": {
            "GCP_KEY": from_secret(gcp_grafanauploads_base64),
            "PRERELEASE_BUCKET": from_secret("prerelease_bucket"),
            "STATIC_ASSET_EDITIONS": from_secret("static_asset_editions"),
        },
        "commands": [
            "./bin/build artifacts static-assets --tag ${DRONE_TAG} --static-asset-editions=grafana-oss",
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
        publish_static_assets_step(),
        publish_storybook_step(),
    ]

    return [
        pipeline(
            name = "publish-artifacts-{}".format(mode),
            trigger = trigger,
            steps = steps,
            environment = {"EDITION": "oss"},
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
    ]

    deps = [
        "publish-artifacts-public",
        "publish-docker-public",
    ]

    return [
        pipeline(
            name = "publish-packages",
            trigger = trigger,
            steps = oss_steps,
            depends_on = deps,
            environment = {"EDITION": "oss"},
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
                             mysql_integration_tests_steps("mysql57", "5.7") + \
                             mysql_integration_tests_steps("mysql80", "8.0") + \
                             redis_integration_tests_steps() + \
                             memcached_integration_tests_steps()

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
        trigger = release_trigger,
        depends_on = [
            "release-build-e2e-publish",
            "release-windows",
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
