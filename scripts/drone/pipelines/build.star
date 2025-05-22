"""This module contains the comprehensive build pipeline."""

load(
    "scripts/drone/steps/github.star",
    "github_app_generate_token_step",
    "github_app_pipeline_volumes",
)
load(
    "scripts/drone/steps/lib.star",
    "build_frontend_package_step",
    "build_storybook_step",
    "build_test_plugins_step",
    "compile_build_cmd",
    "download_grabpl_step",
    "e2e_tests_artifacts",
    "e2e_tests_step",
    "enterprise_downstream_step",
    "frontend_metrics_step",
    "grafana_server_step",
    "identify_runner_step",
    "playwright_e2e_report_post_link",
    "playwright_e2e_report_upload",
    "playwright_e2e_tests_step",
    "publish_images_step",
    "release_canary_npm_packages_step",
    "store_storybook_step",
    "test_a11y_frontend_step",
    "trigger_oss",
    "update_package_json_version",
    "upload_cdn_step",
    "upload_packages_step",
    "verify_gen_cue_step",
    "verify_gen_jsonnet_step",
    "yarn_install_step",
)
load(
    "scripts/drone/steps/rgm.star",
    "rgm_artifacts_step",
)
load(
    "scripts/drone/utils/images.star",
    "images",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

# This function isn't actually unused but I don't know why the linter thinks it is...
# @unused
def build_e2e(trigger, ver_mode):
    """Perform e2e building, testing, and publishing.

    Args:
      trigger: controls which events can trigger the pipeline execution.
      ver_mode: used in the naming of the pipeline. Either 'pr' or 'main'.

    Returns:
      Drone pipeline.
    """

    environment = {"EDITION": "oss"}
    init_steps = [
        github_app_generate_token_step(),
        identify_runner_step(),
        download_grabpl_step(),
        compile_build_cmd(),
        verify_gen_cue_step(),
        verify_gen_jsonnet_step(),
        yarn_install_step(),
    ]

    build_steps = []

    create_packages = rgm_artifacts_step(
        alpine = images["alpine"],
        artifacts = [
            "targz:grafana:linux/amd64",
            "targz:grafana:linux/arm64",
            "targz:grafana:linux/arm/v7",
            "docker:grafana:linux/amd64",
            "docker:grafana:linux/amd64:ubuntu",
            "docker:grafana:linux/arm64",
            "docker:grafana:linux/arm64:ubuntu",
            "docker:grafana:linux/arm/v7",
            "docker:grafana:linux/arm/v7:ubuntu",
        ],
        file = "packages.txt",
        tag_format = "{{ .version_base }}-{{ .buildID }}-{{ .arch }}",
        ubuntu = images["ubuntu"],
        ubuntu_tag_format = "{{ .version_base }}-{{ .buildID }}-ubuntu-{{ .arch }}",
    )

    publish_docker = publish_images_step(
        depends_on = [create_packages["name"]],
        docker_repo = "grafana",
        trigger = trigger_oss,
        ver_mode = ver_mode,
    )

    if ver_mode == "pr":
        build_steps.extend(
            [
                build_frontend_package_step(),
                enterprise_downstream_step(ver_mode = ver_mode),
            ],
        )
    else:
        # The only other event or "ver_mode" where this is used is 'main'
        update_package_json = update_package_json_version()
        create_packages["depends_on"] = [update_package_json["name"]]

        build_steps.extend([
            update_package_json,
            build_frontend_package_step(depends_on = ["update-package-json-version"]),
        ])

    build_steps.extend(
        [
            create_packages,
            publish_docker,
            build_test_plugins_step(),
            grafana_server_step(),
            e2e_tests_step("dashboards-suite"),
            e2e_tests_step("old-arch/dashboards-suite"),
            e2e_tests_step("smoke-tests-suite"),
            e2e_tests_step("old-arch/smoke-tests-suite"),
            e2e_tests_step("panels-suite"),
            e2e_tests_step("old-arch/panels-suite"),
            e2e_tests_step("various-suite"),
            e2e_tests_step("old-arch/various-suite"),
            playwright_e2e_tests_step(),
            playwright_e2e_report_upload(),
            playwright_e2e_report_post_link(),
            e2e_tests_artifacts(),
            build_storybook_step(ver_mode = ver_mode),
            test_a11y_frontend_step(ver_mode = ver_mode),
        ],
    )

    if ver_mode == "main":
        build_steps.extend(
            [
                store_storybook_step(trigger = trigger_oss, ver_mode = ver_mode),
                frontend_metrics_step(trigger = trigger_oss),
                publish_images_step(
                    depends_on = [create_packages["name"]],
                    docker_repo = "grafana-oss",
                    trigger = trigger_oss,
                    ver_mode = ver_mode,
                ),
                release_canary_npm_packages_step(trigger = trigger_oss),
                upload_packages_step(
                    depends_on = [create_packages["name"]],
                    trigger = trigger_oss,
                    ver_mode = ver_mode,
                ),
                upload_cdn_step(
                    depends_on = [create_packages["name"]],
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
        volumes = github_app_pipeline_volumes(),
    )
