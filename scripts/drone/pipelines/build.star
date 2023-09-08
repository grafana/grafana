"""This module contains the comprehensive build pipeline."""

load(
    "scripts/drone/steps/lib.star",
    "build_backend_step",
    "build_docker_images_step",
    "build_frontend_package_step",
    "build_frontend_step",
    "build_plugins_step",
    "build_storybook_step",
    "cloud_plugins_e2e_tests_step",
    "compile_build_cmd",
    "copy_packages_for_docker_step",
    "download_grabpl_step",
    "e2e_tests_artifacts",
    "e2e_tests_step",
    "enterprise_downstream_step",
    "frontend_metrics_step",
    "grafana_server_step",
    "identify_runner_step",
    "publish_images_step",
    "release_canary_npm_packages_step",
    "store_storybook_step",
    "test_a11y_frontend_step",
    "trigger_oss",
    "trigger_test_release",
    "upload_cdn_step",
    "upload_packages_step",
    "verify_gen_cue_step",
    "verify_gen_jsonnet_step",
    "wire_install_step",
    "yarn_install_step",
)
load(
    "scripts/drone/steps/rgm.star",
    "rgm_package_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

# @unused
def build_e2e(trigger, ver_mode):
    """Perform e2e building, testing, and publishing.

    Args:
      trigger: controls which events can trigger the pipeline execution.
      ver_mode: used in the naming of the pipeline.

    Returns:
      Drone pipeline.
    """

    environment = {"EDITION": "oss"}
    init_steps = [
        identify_runner_step(),
        download_grabpl_step(),
        compile_build_cmd(),
        verify_gen_cue_step(),
        verify_gen_jsonnet_step(),
        wire_install_step(),
        yarn_install_step(),
    ]

    build_steps = []

    if ver_mode == "pr":
        build_steps.extend(
            [
                trigger_test_release(),
                enterprise_downstream_step(ver_mode = ver_mode),
            ],
        )

    build_steps.extend(
        [
            build_frontend_package_step(),
            rgm_package_step(distros = "linux/amd64"),
            grafana_server_step(),
            e2e_tests_step("dashboards-suite"),
            e2e_tests_step("smoke-tests-suite"),
            e2e_tests_step("panels-suite"),
            e2e_tests_step("various-suite"),
            cloud_plugins_e2e_tests_step(
                "cloud-plugins-suite",
                cloud = "azure",
                trigger = trigger_oss,
            ),
            e2e_tests_artifacts(),
            build_storybook_step(ver_mode = ver_mode),
            copy_packages_for_docker_step(),
            test_a11y_frontend_step(ver_mode = ver_mode),
        ],
    )

    if ver_mode == "main":
        build_steps.extend(
            [
                store_storybook_step(trigger = trigger_oss, ver_mode = ver_mode),
                frontend_metrics_step(trigger = trigger_oss),
                build_docker_images_step(
                    publish = False,
                ),
                build_docker_images_step(
                    publish = False,
                    ubuntu = True,
                ),
                publish_images_step(
                    docker_repo = "grafana",
                    trigger = trigger_oss,
                    ver_mode = ver_mode,
                ),
                publish_images_step(
                    docker_repo = "grafana-oss",
                    trigger = trigger_oss,
                    ver_mode = ver_mode,
                ),
                release_canary_npm_packages_step(trigger = trigger_oss),
                upload_packages_step(
                    trigger = trigger_oss,
                    ver_mode = ver_mode,
                ),
                upload_cdn_step(
                    trigger = trigger_oss,
                    ver_mode = ver_mode,
                ),
            ],
        )
    elif ver_mode == "pr":
        build_steps.extend(
            [
                build_docker_images_step(
                    archs = [
                        "amd64",
                    ],
                ),
                build_docker_images_step(
                    archs = [
                        "amd64",
                    ],
                    ubuntu = True,
                ),
                publish_images_step(
                    docker_repo = "grafana",
                    trigger = trigger_oss,
                    ver_mode = ver_mode,
                ),
            ],
        )

    publish_suffix = ""
    if ver_mode == "main":
        publish_suffix = "-publish"

    return pipeline(
        name = "{}-build-e2e{}".format(ver_mode, publish_suffix),
        environment = environment,
        services = [],
        steps = init_steps + build_steps,
        trigger = trigger,
    )
