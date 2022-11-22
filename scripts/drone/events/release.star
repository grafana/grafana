"""
This module returns all the pipelines used in the event of a release along with supporting functions.
"""

load(
    "scripts/drone/steps/lib.star",
    "artifacts_page_step",
    "build_backend_step",
    "build_docker_images_step",
    "build_frontend_package_step",
    "build_frontend_step",
    "build_image",
    "build_plugins_step",
    "build_storybook_step",
    "clone_enterprise_step",
    "compile_build_cmd",
    "copy_packages_for_docker_step",
    "disable_tests",
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
    "publish_image",
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
)
load(
    "scripts/drone/pipelines/test_frontend.star",
    "test_frontend",
)
load(
    "scripts/drone/pipelines/test_backend.star",
    "test_backend",
)
load("scripts/drone/vault.star", "from_secret", "prerelease_bucket")

ver_mode = "release"
release_trigger = {
    "event": {
        "exclude": [
            "promote",
        ],
    },
    "ref": ["refs/tags/v*"],
}

def store_npm_packages_step():
    return {
        "name": "store-npm-packages",
        "image": build_image,
        "depends_on": [
            "build-frontend-packages",
        ],
        "environment": {
            "GCP_KEY": from_secret("gcp_key"),
            "PRERELEASE_BUCKET": from_secret(prerelease_bucket),
        },
        "commands": [
            "./bin/grabpl artifacts npm store --tag ${DRONE_TAG}",
        ],
    }

def retrieve_npm_packages_step():
    return {
        "name": "retrieve-npm-packages",
        "image": publish_image,
        "depends_on": [
            "yarn-install",
        ],
        "failure": "ignore",
        "environment": {
            "GCP_KEY": from_secret("gcp_key"),
            "PRERELEASE_BUCKET": from_secret(prerelease_bucket),
        },
        "commands": [
            "./bin/grabpl artifacts npm retrieve --tag ${DRONE_TAG}",
        ],
    }

def release_npm_packages_step():
    return {
        "name": "release-npm-packages",
        "image": build_image,
        "depends_on": [
            "retrieve-npm-packages",
        ],
        "failure": "ignore",
        "environment": {
            "NPM_TOKEN": from_secret("npm_token"),
        },
        "commands": [
            "./bin/grabpl artifacts npm release --tag ${DRONE_TAG}",
        ],
    }

def oss_pipelines(ver_mode = ver_mode, trigger = release_trigger):
    """Generates all pipelines used in an OSS release.

    Args:
      ver_mode: controls which steps are included in the pipeline.
        Defaults to 'release'.
      trigger: controls which events can trigger the pipeline execution.
        Defaults to tag events for tags with a 'v' prefix.

    Returns:
      List of Drone pipelines.
    """
    environment = {"EDITION": "oss"}
    edition = "oss"
    services = integration_test_services(edition = edition)
    volumes = integration_test_services_volumes()
    package_steps = []
    publish_steps = []
    should_publish = ver_mode == "release"
    should_upload = should_publish or ver_mode in ("release-branch",)
    init_steps = [
        identify_runner_step(),
        download_grabpl_step(),
        verify_gen_cue_step(edition),
        wire_install_step(),
        yarn_install_step(),
        compile_build_cmd(),
    ]

    build_steps = [
        build_backend_step(edition = edition, ver_mode = ver_mode),
        build_frontend_step(edition = edition, ver_mode = ver_mode),
        build_frontend_package_step(edition = edition, ver_mode = ver_mode),
        build_plugins_step(edition = edition, ver_mode = ver_mode),
    ]

    integration_test_steps = [
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
    ]

    # Insert remaining steps
    build_steps.extend([
        package_step(edition = edition, ver_mode = ver_mode),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition = edition, publish = True),
        build_docker_images_step(edition = edition, ubuntu = True, publish = True),
        grafana_server_step(edition = edition),
    ])

    if not disable_tests:
        build_steps.extend([
            e2e_tests_step("dashboards-suite", edition = edition, tries = 3),
            e2e_tests_step("smoke-tests-suite", edition = edition, tries = 3),
            e2e_tests_step("panels-suite", edition = edition, tries = 3),
            e2e_tests_step("various-suite", edition = edition, tries = 3),
            e2e_tests_artifacts(edition = edition),
        ])

    build_storybook = build_storybook_step(edition = edition, ver_mode = ver_mode)
    if build_storybook:
        build_steps.append(build_storybook)

    if should_upload:
        publish_steps.append(upload_cdn_step(edition = edition, ver_mode = ver_mode, trigger = trigger_oss))
        publish_steps.append(upload_packages_step(edition = edition, ver_mode = ver_mode, trigger = trigger_oss))
    if should_publish:
        publish_step = store_storybook_step(edition = edition, ver_mode = ver_mode)
        store_npm_step = store_npm_packages_step()
        if publish_step:
            publish_steps.append(publish_step)
        if store_npm_step:
            publish_steps.append(store_npm_step)
    windows_package_steps = get_windows_steps(edition = edition, ver_mode = ver_mode)

    windows_pipeline = pipeline(
        name = "{}-oss-windows".format(ver_mode),
        edition = edition,
        trigger = trigger,
        steps = [identify_runner_step("windows")] + windows_package_steps,
        platform = "windows",
        depends_on = [
            "oss-build{}-publish-{}".format(get_e2e_suffix(), ver_mode),
        ],
        environment = environment,
    )
    pipelines = [
        pipeline(
            name = "{}-oss-build{}-publish".format(ver_mode, get_e2e_suffix()),
            edition = edition,
            trigger = trigger,
            services = [],
            steps = init_steps + build_steps + package_steps + publish_steps,
            environment = environment,
            volumes = volumes,
        ),
    ]
    if not disable_tests:
        pipelines.extend([
            test_frontend(trigger, ver_mode),
            test_backend(trigger, ver_mode),
            pipeline(
                name = "{}-oss-integration-tests".format(ver_mode),
                edition = edition,
                trigger = trigger,
                services = services,
                steps = [download_grabpl_step(), identify_runner_step(), verify_gen_cue_step(edition), verify_gen_jsonnet_step(edition), wire_install_step()] + integration_test_steps,
                environment = environment,
                volumes = volumes,
            ),
        ])
        deps = {
            "depends_on": [
                "{}-oss-build{}-publish".format(ver_mode, get_e2e_suffix()),
                "{}-oss-test-frontend".format(ver_mode),
                "{}-oss-test-backend".format(ver_mode),
                "{}-oss-integration-tests".format(ver_mode),
            ],
        }
        windows_pipeline.update(deps)

    pipelines.extend([windows_pipeline])
    return pipelines

def enterprise_pipelines(ver_mode = ver_mode, trigger = release_trigger):
    """Generates all pipelines used in an an enterprise release.

    Args:
      ver_mode: controls which steps are included in the pipeline.
        Defaults to 'release'.
      trigger: controls which events can trigger the pipeline execution.
        Defaults to tag events for tags with a 'v' prefix.

    Returns:
      List of Drone pipelines.
    """
    environment = {"EDITION": "enterprise"}
    edition = "enterprise"
    services = integration_test_services(edition = edition)
    volumes = integration_test_services_volumes()
    package_steps = []
    publish_steps = []
    should_publish = ver_mode == "release"
    should_upload = should_publish or ver_mode in ("release-branch",)
    include_enterprise = edition == "enterprise"
    edition2 = "enterprise2"
    init_steps = [
        download_grabpl_step(),
        identify_runner_step(),
        clone_enterprise_step(ver_mode),
        init_enterprise_step(ver_mode),
        compile_build_cmd(edition),
    ]

    build_steps = [
        build_backend_step(edition = edition, ver_mode = ver_mode),
        build_frontend_step(edition = edition, ver_mode = ver_mode),
        build_frontend_package_step(edition = edition, ver_mode = ver_mode),
        build_plugins_step(edition = edition, ver_mode = ver_mode),
    ]

    integration_test_steps = [
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
    ]

    if include_enterprise:
        build_steps.extend([
            build_backend_step(edition = edition2, ver_mode = ver_mode, variants = ["linux-amd64"]),
        ])

    # Insert remaining steps
    build_steps.extend([
        package_step(edition = edition, ver_mode = ver_mode),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition = edition, publish = True),
        build_docker_images_step(edition = edition, ubuntu = True, publish = True),
        grafana_server_step(edition = edition),
    ])

    if not disable_tests:
        build_steps.extend([
            e2e_tests_step("dashboards-suite", edition = edition, tries = 3),
            e2e_tests_step("smoke-tests-suite", edition = edition, tries = 3),
            e2e_tests_step("panels-suite", edition = edition, tries = 3),
            e2e_tests_step("various-suite", edition = edition, tries = 3),
            e2e_tests_artifacts(edition = edition),
        ])

    build_storybook = build_storybook_step(edition = edition, ver_mode = ver_mode)
    if build_storybook:
        build_steps.append(build_storybook)

    if should_upload:
        publish_steps.extend([
            upload_cdn_step(edition = edition, ver_mode = ver_mode, trigger = trigger_oss),
            upload_packages_step(edition = edition, ver_mode = ver_mode, trigger = trigger_oss),
            package_step(edition = edition2, ver_mode = ver_mode, variants = ["linux-amd64"]),
            upload_cdn_step(edition = edition2, ver_mode = ver_mode),
        ])
    if should_publish:
        publish_step = store_storybook_step(edition = edition, ver_mode = ver_mode)
        store_npm_step = store_npm_packages_step()
        if publish_step:
            publish_steps.append(publish_step)
        if store_npm_step:
            publish_steps.append(store_npm_step)
    windows_package_steps = get_windows_steps(edition = edition, ver_mode = ver_mode)

    if should_upload:
        step = upload_packages_step(edition = edition2, ver_mode = ver_mode)
        if step:
            publish_steps.append(step)

    deps_on_clone_enterprise_step = {
        "depends_on": [
            "init-enterprise",
        ],
    }

    for step in [wire_install_step(), yarn_install_step(edition), verify_gen_cue_step(edition), verify_gen_jsonnet_step(edition)]:
        step.update(deps_on_clone_enterprise_step)
        init_steps.extend([step])

    windows_pipeline = pipeline(
        name = "{}-enterprise-windows".format(ver_mode),
        edition = edition,
        trigger = trigger,
        steps = [identify_runner_step("windows")] + windows_package_steps,
        platform = "windows",
        depends_on = [
            "enterprise-build{}-publish-{}".format(get_e2e_suffix(), ver_mode),
        ],
        environment = environment,
    )
    pipelines = [
        pipeline(
            name = "{}-enterprise-build{}-publish".format(ver_mode, get_e2e_suffix()),
            edition = edition,
            trigger = trigger,
            services = [],
            steps = init_steps + build_steps + package_steps + publish_steps,
            environment = environment,
            volumes = volumes,
        ),
    ]
    if not disable_tests:
        pipelines.extend([
            test_frontend(trigger, ver_mode, edition),
            test_backend(trigger, ver_mode, edition),
            pipeline(
                name = "{}-enterprise-integration-tests".format(ver_mode),
                edition = edition,
                trigger = trigger,
                services = services,
                steps = [download_grabpl_step(), identify_runner_step(), clone_enterprise_step(ver_mode), init_enterprise_step(ver_mode), verify_gen_cue_step(edition), verify_gen_jsonnet_step(edition), wire_install_step()] + integration_test_steps + [redis_integration_tests_step(), memcached_integration_tests_step()],
                environment = environment,
                volumes = volumes,
            ),
        ])
        deps = {
            "depends_on": [
                "{}-enterprise-build{}-publish".format(ver_mode, get_e2e_suffix()),
                "{}-enterprise-test-frontend".format(ver_mode),
                "{}-enterprise-test-backend".format(ver_mode),
                "{}-enterprise-integration-tests".format(ver_mode),
            ],
        }
        windows_pipeline.update(deps)

    pipelines.extend([windows_pipeline])

    return pipelines

def enterprise2_pipelines(prefix = "", ver_mode = ver_mode, trigger = release_trigger):
    """TODO

    Args:
      prefix: TODO
        Defaults to ''.
      ver_mode: controls which steps are included in the pipeline.
        Defaults to 'release'.
      trigger: controls which events can trigger the pipeline execution.
        Defaults to tag events for tags with a 'v' prefix.

    Returns:
      List of Drone pipelines.
    """
    environment = {
        "EDITION": "enterprise2",
    }
    edition = "enterprise"
    volumes = integration_test_services_volumes()
    package_steps = []
    publish_steps = []
    should_publish = ver_mode == "release"
    should_upload = should_publish or ver_mode in ("release-branch",)
    include_enterprise = edition == "enterprise"
    edition2 = "enterprise2"
    init_steps = [
        download_grabpl_step(),
        identify_runner_step(),
        clone_enterprise_step(ver_mode),
        init_enterprise_step(ver_mode),
        compile_build_cmd(edition),
    ]

    build_steps = [
        build_frontend_step(edition = edition, ver_mode = ver_mode),
        build_frontend_package_step(edition = edition, ver_mode = ver_mode),
        build_plugins_step(edition = edition, ver_mode = ver_mode),
    ]

    if include_enterprise:
        build_steps.extend([
            build_backend_step(edition = edition2, ver_mode = ver_mode, variants = ["linux-amd64"]),
        ])

    fetch_images = fetch_images_step(edition2)
    fetch_images.update({"depends_on": ["build-docker-images", "build-docker-images-ubuntu"]})
    upload_cdn = upload_cdn_step(edition = edition2, ver_mode = ver_mode)
    upload_cdn["environment"].update({"ENTERPRISE2_CDN_PATH": from_secret("enterprise2-cdn-path")})

    build_steps.extend([
        package_step(edition = edition2, ver_mode = ver_mode, variants = ["linux-amd64"]),
        upload_cdn,
        copy_packages_for_docker_step(edition = edition2),
        build_docker_images_step(edition = edition2, publish = True),
        build_docker_images_step(edition = edition2, ubuntu = True, publish = True),
        fetch_images,
        publish_images_step(edition2, "release", mode = edition2, docker_repo = "${{DOCKER_ENTERPRISE2_REPO}}"),
    ])

    if should_upload:
        step = upload_packages_step(edition = edition2, ver_mode = ver_mode)
        if step:
            publish_steps.append(step)

    deps_on_clone_enterprise_step = {
        "depends_on": [
            "init-enterprise",
        ],
    }

    for step in [wire_install_step(), yarn_install_step(), verify_gen_cue_step(edition)]:
        step.update(deps_on_clone_enterprise_step)
        init_steps.extend([step])

    pipelines = [
        pipeline(
            name = "{}{}-enterprise2-build{}-publish".format(prefix, ver_mode, get_e2e_suffix()),
            edition = edition,
            trigger = trigger,
            services = [],
            steps = init_steps + build_steps + package_steps + publish_steps,
            volumes = volumes,
            environment = environment,
        ),
    ]

    return pipelines

def publish_artifacts_step(mode):
    security = ""
    if mode == "security":
        security = "--security "
    return {
        "name": "publish-artifacts",
        "image": publish_image,
        "environment": {
            "GCP_KEY": from_secret("gcp_key"),
            "PRERELEASE_BUCKET": from_secret("prerelease_bucket"),
        },
        "commands": ["./bin/grabpl artifacts publish {}--tag $${{DRONE_TAG}} --src-bucket $${{PRERELEASE_BUCKET}}".format(security)],
        "depends_on": ["grabpl"],
    }

def publish_artifacts_pipelines(mode):
    trigger = {
        "event": ["promote"],
        "target": [mode],
    }
    steps = [
        download_grabpl_step(),
        publish_artifacts_step(mode),
    ]

    return [pipeline(
        name = "publish-artifacts-{}".format(mode),
        trigger = trigger,
        steps = steps,
        edition = "all",
        environment = {"EDITION": "all"},
    )]

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
        download_grabpl_step(),
        compile_build_cmd(),
        publish_linux_packages_step(edition = "oss", package_manager = "deb"),
        publish_linux_packages_step(edition = "oss", package_manager = "rpm"),
        publish_grafanacom_step(edition = "oss", ver_mode = "release"),
    ]

    enterprise_steps = [
        download_grabpl_step(),
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

    return [pipeline(
        name = "publish-packages-oss",
        trigger = trigger,
        steps = oss_steps,
        edition = "all",
        depends_on = deps,
        environment = {"EDITION": "oss"},
    ), pipeline(
        name = "publish-packages-enterprise",
        trigger = trigger,
        steps = enterprise_steps,
        edition = "all",
        depends_on = deps,
        environment = {"EDITION": "enterprise"},
    )]

def publish_npm_pipelines(mode):
    trigger = {
        "event": ["promote"],
        "target": [mode],
    }
    steps = [
        download_grabpl_step(),
        yarn_install_step(),
        retrieve_npm_packages_step(),
        release_npm_packages_step(),
    ]

    return [pipeline(
        name = "publish-npm-packages-{}".format(mode),
        trigger = trigger,
        steps = steps,
        edition = "all",
        environment = {"EDITION": "all"},
    )]

def artifacts_page_pipeline():
    trigger = {
        "event": ["promote"],
        "target": "security",
    }
    return [pipeline(
        name = "publish-artifacts-page",
        trigger = trigger,
        steps = [download_grabpl_step(), artifacts_page_step()],
        edition = "all",
        environment = {"EDITION": "all"},
    )]

def get_e2e_suffix():
    if not disable_tests:
        return "-e2e"
    return ""
