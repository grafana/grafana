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
    "clone_enterprise_step",
    "compile_build_cmd",
    "copy_packages_for_docker_step",
    "download_grabpl_step",
    "e2e_tests_artifacts",
    "e2e_tests_step",
    "fetch_images_step",
    "get_windows_steps",
    "grafana_server_step",
    "identify_runner_step",
    "init_enterprise_step",
    "memcached_integration_tests_step",
    "mysql_integration_tests_step",
    "package_step",
    "postgres_integration_tests_step",
    "publish_grafanacom_step",
    "publish_images_step",
    "publish_linux_packages_step",
    "redis_integration_tests_step",
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
    "scripts/drone/services/services.star",
    "integration_test_services",
    "integration_test_services_volumes",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
    "with_deps",
)
load(
    "scripts/drone/pipelines/test_frontend.star",
    "test_frontend",
    "test_frontend_enterprise",
)
load(
    "scripts/drone/pipelines/test_backend.star",
    "test_backend",
    "test_backend_enterprise",
)
load("scripts/drone/vault.star", "from_secret", "prerelease_bucket")
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

def store_npm_packages_step():
    return {
        "name": "store-npm-packages",
        "image": images["build_image"],
        "depends_on": [
            "compile-build-cmd",
            "build-frontend-packages",
        ],
        "environment": {
            "GCP_KEY": from_secret("gcp_key"),
            "PRERELEASE_BUCKET": from_secret(prerelease_bucket),
        },
        "commands": ["./bin/build artifacts npm store --tag ${DRONE_TAG}"],
    }

def retrieve_npm_packages_step():
    return {
        "name": "retrieve-npm-packages",
        "image": images["publish_image"],
        "depends_on": [
            "compile-build-cmd",
            "yarn-install",
        ],
        "failure": "ignore",
        "environment": {
            "GCP_KEY": from_secret("gcp_key"),
            "PRERELEASE_BUCKET": from_secret(prerelease_bucket),
        },
        "commands": ["./bin/build artifacts npm retrieve --tag ${DRONE_TAG}"],
    }

def release_npm_packages_step():
    return {
        "name": "release-npm-packages",
        "image": images["build_image"],
        "depends_on": [
            "compile-build-cmd",
            "retrieve-npm-packages",
        ],
        "failure": "ignore",
        "environment": {
            "NPM_TOKEN": from_secret("npm_token"),
        },
        "commands": ["./bin/build artifacts npm release --tag ${DRONE_TAG}"],
    }

def oss_pipelines(ver_mode = ver_mode, trigger = release_trigger):
    """Generates all pipelines used for Grafana OSS.

    Args:
      ver_mode: controls which steps are included in the pipeline.
        Defaults to 'release'.
      trigger: controls which events can trigger the pipeline execution.
        Defaults to tag events for tags with a 'v' prefix.

    Returns:
      List of Drone pipelines.
    """

    environment = {"EDITION": "oss"}

    services = integration_test_services()
    volumes = integration_test_services_volumes()

    init_steps = [
        identify_runner_step(),
        download_grabpl_step(),
        verify_gen_cue_step(),
        wire_install_step(),
        yarn_install_step(),
        compile_build_cmd(),
    ]

    build_steps = [
        build_backend_step(edition = "oss", ver_mode = ver_mode),
        build_frontend_step(edition = "oss", ver_mode = ver_mode),
        build_frontend_package_step(edition = "oss", ver_mode = ver_mode),
        build_plugins_step(edition = "oss", ver_mode = ver_mode),
        package_step(edition = "oss", ver_mode = ver_mode),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition = "oss", publish = True),
        build_docker_images_step(
            edition = "oss",
            publish = True,
            ubuntu = True,
        ),
        grafana_server_step(edition = "oss"),
        e2e_tests_step("dashboards-suite", tries = 3),
        e2e_tests_step("smoke-tests-suite", tries = 3),
        e2e_tests_step("panels-suite", tries = 3),
        e2e_tests_step("various-suite", tries = 3),
        e2e_tests_artifacts(),
        build_storybook_step(ver_mode = ver_mode),
    ]

    publish_steps = []

    if ver_mode in (
        "release",
        "release-branch",
    ):
        publish_steps.extend(
            [
                upload_cdn_step(edition = "oss", ver_mode = ver_mode, trigger = trigger_oss),
                upload_packages_step(
                    edition = "oss",
                    ver_mode = ver_mode,
                    trigger = trigger_oss,
                ),
            ],
        )

    if ver_mode in ("release",):
        publish_steps.extend(
            [
                store_storybook_step(ver_mode = ver_mode),
                store_npm_packages_step(),
            ],
        )

    integration_test_steps = [
        postgres_integration_tests_step(),
        mysql_integration_tests_step("mysql57", "5.7"),
        mysql_integration_tests_step("mysql80", "8.0"),
        redis_integration_tests_step(),
        memcached_integration_tests_step(),
    ]

    pipelines = []

    # We don't need to run integration tests at release time since they have
    # been run multiple times before:
    if ver_mode in ("release"):
        pipelines.append(whats_new_checker_pipeline(release_trigger))
        integration_test_steps = []
        volumes = []

    windows_pipeline_dependencies = [
        "{}-oss-build-e2e-publish".format(ver_mode),
        "{}-oss-test-frontend".format(ver_mode),
    ]
    pipelines.extend([
        pipeline(
            name = "{}-oss-build-e2e-publish".format(ver_mode),
            edition = "oss",
            trigger = trigger,
            services = [],
            steps = init_steps + build_steps + publish_steps,
            environment = environment,
            volumes = volumes,
        ),
        test_frontend(trigger, ver_mode),
        test_backend(trigger, ver_mode),
    ])

    if ver_mode not in ("release"):
        pipelines.append(pipeline(
            name = "{}-oss-integration-tests".format(ver_mode),
            edition = "oss",
            trigger = trigger,
            services = services,
            steps = [
                        download_grabpl_step(),
                        identify_runner_step(),
                        verify_gen_cue_step(),
                        verify_gen_jsonnet_step(),
                        wire_install_step(),
                    ] +
                    integration_test_steps,
            environment = environment,
            volumes = volumes,
        ))

    windows_pipeline = pipeline(
        name = "{}-oss-windows".format(ver_mode),
        edition = "oss",
        trigger = trigger,
        steps = get_windows_steps(edition = "oss", ver_mode = ver_mode),
        platform = "windows",
        depends_on = windows_pipeline_dependencies,
        environment = environment,
    )

    pipelines.append(windows_pipeline)

    return pipelines

def enterprise_pipelines(ver_mode = ver_mode, trigger = release_trigger):
    """Generates all pipelines used for Grafana Enterprise.

    Args:
      ver_mode: controls which steps are included in the pipeline.
        Defaults to 'release'.
      trigger: controls which events can trigger the pipeline execution.
        Defaults to tag events for tags with a 'v' prefix.

    Returns:
      List of Drone pipelines.
    """
    if ver_mode == "release":
        source = "${DRONE_TAG}"
    elif ver_mode == "release-branch":
        source = "${DRONE_BRANCH}"
    else:
        source = "${DRONE_COMMIT}"

    environment = {"EDITION": "enterprise"}

    services = integration_test_services()
    volumes = integration_test_services_volumes()

    init_steps = [
        download_grabpl_step(),
        identify_runner_step(),
        clone_enterprise_step(source = source),
        init_enterprise_step(ver_mode),
        compile_build_cmd("enterprise"),
    ] + with_deps(
        [
            wire_install_step(),
            yarn_install_step(),
            verify_gen_cue_step(),
            verify_gen_jsonnet_step(),
        ],
        [
            "init-enterprise",
        ],
    )

    build_steps = [
        build_backend_step(edition = "enterprise", ver_mode = ver_mode),
        build_frontend_step(edition = "enterprise", ver_mode = ver_mode),
        build_frontend_package_step(edition = "enterprise", ver_mode = ver_mode),
        build_plugins_step(edition = "enterprise", ver_mode = ver_mode),
        package_step(
            edition = "enterprise",
            ver_mode = ver_mode,
        ),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition = "enterprise", publish = True),
        build_docker_images_step(
            edition = "enterprise",
            publish = True,
            ubuntu = True,
        ),
        grafana_server_step(edition = "enterprise"),
        e2e_tests_step("dashboards-suite", tries = 3),
        e2e_tests_step("smoke-tests-suite", tries = 3),
        e2e_tests_step("panels-suite", tries = 3),
        e2e_tests_step("various-suite", tries = 3),
        e2e_tests_artifacts(),
    ]

    publish_steps = []

    if ver_mode in (
        "release",
        "release-branch",
    ):
        upload_packages_enterprise = upload_packages_step(
            edition = "enterprise",
            ver_mode = ver_mode,
            trigger = trigger_oss,
        )
        upload_packages_enterprise["depends_on"] = ["package"]

        publish_steps.extend(
            [
                upload_cdn_step(
                    edition = "enterprise",
                    ver_mode = ver_mode,
                    trigger = trigger_oss,
                ),
                upload_packages_enterprise,
            ],
        )

    integration_test_steps = [
        postgres_integration_tests_step(),
        mysql_integration_tests_step("mysql57", "5.7"),
        mysql_integration_tests_step("mysql80", "8.0"),
        redis_integration_tests_step(),
        memcached_integration_tests_step(),
    ]

    # We don't need to run integration tests at release time since they have
    # been run multiple times before:
    if ver_mode in ("release"):
        integration_test_steps = []
        volumes = []

    windows_pipeline = pipeline(
        name = "{}-enterprise-windows".format(ver_mode),
        edition = "enterprise",
        trigger = trigger,
        steps = get_windows_steps(edition = "enterprise", ver_mode = ver_mode),
        platform = "windows",
        depends_on = [
            "{}-enterprise-build-e2e-publish".format(ver_mode),
            "{}-enterprise-test-frontend".format(ver_mode),
            "{}-enterprise-test-backend".format(ver_mode),
        ],
        environment = environment,
    )

    pipelines = [
        pipeline(
            name = "{}-enterprise-build-e2e-publish".format(ver_mode),
            edition = "enterprise",
            trigger = trigger,
            services = [],
            steps = init_steps + build_steps + publish_steps,
            environment = environment,
            volumes = volumes,
        ),
        test_frontend_enterprise(trigger, ver_mode, source = source),
        test_backend_enterprise(trigger, ver_mode, source = source),
    ]

    if ver_mode not in ("release"):
        pipelines.append(pipeline(
            name = "{}-enterprise-integration-tests".format(ver_mode),
            edition = "enterprise",
            trigger = trigger,
            services = services,
            steps = [
                        download_grabpl_step(),
                        identify_runner_step(),
                        clone_enterprise_step(source = source),
                        init_enterprise_step(ver_mode),
                    ] +
                    with_deps(
                        [
                            verify_gen_cue_step(),
                            verify_gen_jsonnet_step(),
                        ],
                        [
                            "init-enterprise",
                        ],
                    ) +
                    [
                        wire_install_step(),
                    ] +
                    integration_test_steps,
            environment = environment,
            volumes = volumes,
        ))

    pipelines.append(windows_pipeline)

    return pipelines

def enterprise2_pipelines(prefix = "", ver_mode = ver_mode, trigger = release_trigger):
    """Generate the next generation of pipelines for Grafana Enterprise.

    Args:
      prefix: a prefix for the pipeline name used to differentiate multiple instances of
        the same pipeline.
        Defaults to ''.
      ver_mode: controls which steps are included in the pipeline.
        Defaults to 'release'.
      trigger: controls which events can trigger the pipeline execution.
        Defaults to tag events for tags with a 'v' prefix.

    Returns:
      List of Drone pipelines.
    """
    if ver_mode == "release":
        source = "${DRONE_TAG}"
    elif ver_mode == "release-branch":
        source = "${DRONE_BRANCH}"
    else:
        source = "${DRONE_COMMIT}"

    environment = {
        "EDITION": "enterprise2",
    }

    volumes = integration_test_services_volumes()

    init_steps = [
        download_grabpl_step(),
        identify_runner_step(),
        clone_enterprise_step(source = source),
        init_enterprise_step(ver_mode),
        compile_build_cmd("enterprise"),
    ] + with_deps(
        [
            wire_install_step(),
            yarn_install_step(),
            verify_gen_cue_step(),
        ],
        [
            "init-enterprise",
        ],
    )

    build_steps = [
        build_frontend_step(edition = "enterprise", ver_mode = ver_mode),
        build_frontend_package_step(edition = "enterprise", ver_mode = ver_mode),
        build_plugins_step(edition = "enterprise", ver_mode = ver_mode),
        build_backend_step(
            edition = "enterprise2",
            ver_mode = ver_mode,
            variants = ["linux-amd64"],
        ),
    ]

    fetch_images = fetch_images_step("enterprise2")
    fetch_images.update(
        {"depends_on": ["build-docker-images", "build-docker-images-ubuntu"]},
    )

    upload_cdn = upload_cdn_step(edition = "enterprise2", ver_mode = ver_mode)
    upload_cdn["environment"].update(
        {"ENTERPRISE2_CDN_PATH": from_secret("enterprise2-cdn-path")},
    )

    build_steps.extend(
        [
            package_step(
                edition = "enterprise2",
                ver_mode = ver_mode,
            ),
            upload_cdn,
            copy_packages_for_docker_step(edition = "enterprise2"),
            build_docker_images_step(
                edition = "enterprise2",
                publish = True,
            ),
            build_docker_images_step(
                edition = "enterprise2",
                publish = True,
                ubuntu = True,
            ),
            fetch_images,
            publish_images_step(
                "enterprise2",
                "release",
                docker_repo = "${{DOCKER_ENTERPRISE2_REPO}}",
            ),
        ],
    )

    publish_steps = []

    if ver_mode in (
        "release",
        "release-branch",
    ):
        step = upload_packages_step(edition = "enterprise2", ver_mode = ver_mode)
        step["depends_on"] = ["package-enterprise2"]

        publish_steps.append(step)

    pipelines = [
        pipeline(
            name = "{}{}-enterprise2-build-e2e-publish".format(prefix, ver_mode),
            edition = "enterprise",
            trigger = trigger,
            services = [],
            steps = init_steps + build_steps + publish_steps,
            volumes = volumes,
            environment = environment,
        ),
    ]

    return pipelines

def publish_artifacts_step():
    return {
        "name": "publish-artifacts",
        "image": images["publish_image"],
        "environment": {
            "GCP_KEY": from_secret("gcp_key"),
            "PRERELEASE_BUCKET": from_secret("prerelease_bucket"),
        },
        "commands": [
            "./bin/build artifacts packages --tag $${{DRONE_TAG}} --src-bucket $${{PRERELEASE_BUCKET}}",
        ],
        "depends_on": ["compile-build-cmd"],
    }

def publish_static_assets_step():
    return {
        "name": "publish-static-assets",
        "image": images["publish_image"],
        "environment": {
            "GCP_KEY": from_secret("gcp_key"),
            "PRERELEASE_BUCKET": from_secret("prerelease_bucket"),
            "STATIC_ASSET_EDITIONS": from_secret("static_asset_editions"),
        },
        "commands": [
            "./bin/build artifacts static-assets --tag ${DRONE_TAG}",
        ],
        "depends_on": ["compile-build-cmd"],
    }

def publish_storybook_step():
    return {
        "name": "publish-storybook",
        "image": images["publish_image"],
        "environment": {
            "GCP_KEY": from_secret("gcp_key"),
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
            edition = "all",
            environment = {"EDITION": "all"},
        ),
    ]

def publish_packages_pipeline():
    """Generates pipelines used for publishing packages for both OSS and enterprise.

    Returns:
      List of Drone pipelines. One for each of OSS and enterprise packages.
    """

    trigger = {
        "event": ["promote"],
        "target": ["public"],
    }
    oss_steps = [
        compile_build_cmd(),
        publish_linux_packages_step(edition = "oss", package_manager = "deb"),
        publish_linux_packages_step(edition = "oss", package_manager = "rpm"),
        publish_grafanacom_step(edition = "oss", ver_mode = "release"),
    ]

    enterprise_steps = [
        compile_build_cmd(),
        publish_linux_packages_step(edition = "enterprise", package_manager = "deb"),
        publish_linux_packages_step(edition = "enterprise", package_manager = "rpm"),
        publish_grafanacom_step(edition = "enterprise", ver_mode = "release"),
    ]
    deps = [
        "publish-artifacts-public",
        "publish-docker-oss-public",
        "publish-docker-enterprise-public",
    ]

    return [
        pipeline(
            name = "publish-packages-oss",
            trigger = trigger,
            steps = oss_steps,
            edition = "all",
            depends_on = deps,
            environment = {"EDITION": "oss"},
        ),
        pipeline(
            name = "publish-packages-enterprise",
            trigger = trigger,
            steps = enterprise_steps,
            edition = "all",
            depends_on = deps,
            environment = {"EDITION": "enterprise"},
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
            edition = "all",
            environment = {"EDITION": "all"},
        ),
    ]

def integration_test_pipelines():
    """
    Trigger integration tests on release builds

    These pipelines should be triggered when we have a release that does a lot of
    cherry-picking and we still want to have all the integration tests run on that
    particular build.

    Returns:
      List of Drone pipelines (one for enterprise and one for oss integration tests)
    """
    trigger = {
        "event": ["promote"],
        "target": "integration-tests",
    }
    pipelines = []
    volumes = integration_test_services_volumes()
    integration_test_steps = [
        postgres_integration_tests_step(),
        mysql_integration_tests_step("mysql57", "5.7"),
        mysql_integration_tests_step("mysql80", "8.0"),
        redis_integration_tests_step(),
        memcached_integration_tests_step(),
    ]
    source = "${DRONE_TAG}"

    pipelines.append(pipeline(
        name = "integration-tests-oss",
        edition = "oss",
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

    pipelines.append(pipeline(
        name = "integration-tests-enterprise",
        edition = "enterprise",
        trigger = trigger,
        services = integration_test_services(),
        steps = [
                    download_grabpl_step(),
                    identify_runner_step(),
                    clone_enterprise_step(source = source),
                    init_enterprise_step(ver_mode),
                ] +
                with_deps(
                    [
                        verify_gen_cue_step(),
                        verify_gen_jsonnet_step(),
                    ],
                    [
                        "init-enterprise",
                    ],
                ) +
                [
                    wire_install_step(),
                ] +
                integration_test_steps,
        environment = {"EDITION": "enterprise"},
        volumes = volumes,
    ))

    return pipelines

def verify_release_pipeline(
        name = "verify-prerelease-assets",
        bucket = from_secret(prerelease_bucket),
        gcp_key = from_secret("gcp_key"),
        version = "${DRONE_TAG}",
        trigger = release_trigger,
        depends_on = [
            "release-oss-build-e2e-publish",
            "release-enterprise-build-e2e-publish",
            "release-enterprise2-build-e2e-publish",
            "release-oss-windows",
            "release-enterprise-windows",
        ]):
    """
    Runs a script that 'gsutil stat's every artifact that should have been produced by the pre-release process.

    Returns:
      A single Drone pipeline that runs the script.
    """
    step = {
        "name": "gsutil-stat",
        "depends_on": ["clone"],
        "image": images["cloudsdk_image"],
        "environment": {
            "BUCKET": bucket,
            "GCP_KEY": gcp_key,
        },
        "commands": [
            "apt-get update && apt-get install -yq gettext",
            "printenv GCP_KEY | base64 -d > /tmp/key.json",
            "gcloud auth activate-service-account --key-file=/tmp/key.json",
            "./scripts/list-release-artifacts.sh {} | xargs -n1 gsutil stat".format(version),
        ],
    }
    return pipeline(
        depends_on = depends_on,
        name = name,
        edition = "all",
        trigger = trigger,
        steps = [step],
    )
