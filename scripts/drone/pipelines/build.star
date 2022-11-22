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
    "package_step",
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
    "scripts/drone/utils/utils.star",
    "pipeline",
)

# @unused
def build_e2e(trigger, ver_mode, edition):
    """TODO

    Args:
      trigger: TODO
      ver_mode: TODO
      edition: TODO

    Returns:
      TODO
    """
    environment = {"EDITION": edition}
    variants = ["linux-amd64", "linux-amd64-musl", "darwin-amd64", "windows-amd64"]
    init_steps = [
        identify_runner_step(),
        download_grabpl_step(),
        compile_build_cmd(),
        verify_gen_cue_step(edition = "oss"),
        verify_gen_jsonnet_step(edition = "oss"),
        wire_install_step(),
        yarn_install_step(),
    ]
    build_steps = []
    if ver_mode == "pr":
        build_steps.extend([trigger_test_release()])
        build_steps.extend([enterprise_downstream_step(edition = edition, ver_mode = ver_mode)])
    build_steps.extend([
        build_backend_step(edition = edition, ver_mode = ver_mode),
        build_frontend_step(edition = edition, ver_mode = ver_mode),
        build_frontend_package_step(edition = edition, ver_mode = ver_mode),
        build_plugins_step(edition = edition, ver_mode = ver_mode),
    ])
    if ver_mode == "main":
        build_steps.extend([package_step(edition = edition, ver_mode = ver_mode)])
    elif ver_mode == "pr":
        build_steps.extend([package_step(edition = edition, variants = variants, ver_mode = ver_mode)])

    build_steps.extend([
        grafana_server_step(edition = edition),
        e2e_tests_step("dashboards-suite", edition = edition),
        e2e_tests_step("smoke-tests-suite", edition = edition),
        e2e_tests_step("panels-suite", edition = edition),
        e2e_tests_step("various-suite", edition = edition),
        cloud_plugins_e2e_tests_step("cloud-plugins-suite", cloud = "azure", edition = edition, trigger = trigger_oss),
        e2e_tests_artifacts(edition = edition),
        build_storybook_step(edition = edition, ver_mode = ver_mode),
        copy_packages_for_docker_step(),
        test_a11y_frontend_step(edition = edition, ver_mode = ver_mode),
    ])
    if ver_mode == "main":
        build_steps.extend([
            store_storybook_step(edition = edition, trigger = trigger_oss, ver_mode = ver_mode),
            frontend_metrics_step(edition = edition, trigger = trigger_oss),
        ])

    if ver_mode == "main":
        build_steps.extend([
            build_docker_images_step(edition = edition, publish = False),
            build_docker_images_step(edition = edition, publish = False, ubuntu = True),
            publish_images_step(docker_repo = "grafana", edition = edition, mode = "", trigger = trigger_oss, ver_mode = ver_mode),
            publish_images_step(docker_repo = "grafana-oss", edition = edition, mode = "", trigger = trigger_oss, ver_mode = ver_mode),
            release_canary_npm_packages_step(edition, trigger = trigger_oss),
            upload_packages_step(edition = edition, trigger = trigger_oss, ver_mode = ver_mode),
            upload_cdn_step(edition = edition, trigger = trigger_oss, ver_mode = ver_mode),
        ])
    elif ver_mode == "pr":
        build_steps.extend([build_docker_images_step(archs = ["amd64"], edition = edition)])

    publish_suffix = ""
    if ver_mode == "main":
        publish_suffix = "-publish"

    return pipeline(
        name = "{}-build-e2e{}".format(ver_mode, publish_suffix),
        edition = "oss",
        environment = environment,
        services = [],
        steps = init_steps + build_steps,
        trigger = trigger,
    )
