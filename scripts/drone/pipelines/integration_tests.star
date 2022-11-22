"""
This module returns the pipeline used for integration tests.
"""

load(
    "scripts/drone/steps/lib.star",
    "compile_build_cmd",
    "download_grabpl_step",
    "identify_runner_step",
    "mysql_integration_tests_step",
    "postgres_integration_tests_step",
    "verify_gen_cue_step",
    "verify_gen_jsonnet_step",
    "wire_install_step",
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

def integration_tests(trigger, ver_mode, edition):
    """Generate a pipeline for integration tests.

    Args:
      trigger: controls which events can trigger the pipeline execution.
      ver_mode: used in the naming of the pipeline.
      edition: passed as the EDITION environment variable to pipeline steps.

    Returns:
      Drone pipeline.
    """
    environment = {"EDITION": edition}
    services = integration_test_services(edition)
    volumes = integration_test_services_volumes()
    init_steps = [
        download_grabpl_step(),
        compile_build_cmd(),
        identify_runner_step(),
        verify_gen_cue_step(edition = "oss"),
        verify_gen_jsonnet_step(edition = "oss"),
        wire_install_step(),
    ]
    test_steps = [
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
    ]

    return pipeline(
        name = "{}-integration-tests".format(ver_mode),
        edition = "oss",
        trigger = trigger,
        services = services,
        steps = init_steps + test_steps,
        environment = environment,
        volumes = volumes,
    )
