"""
This module returns the pipeline used for integration tests.
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
)
load(
    "scripts/drone/steps/lib.star",
    "compile_build_cmd",
    "download_grabpl_step",
    "enterprise_setup_step",
    "identify_runner_step",
    "memcached_integration_tests_steps",
    "mysql_integration_tests_steps",
    "postgres_integration_tests_steps",
    "redis_integration_tests_steps",
    "remote_alertmanager_integration_tests_steps",
    "verify_gen_cue_step",
    "verify_gen_jsonnet_step",
    "wire_install_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

def integration_tests(trigger, prefix, ver_mode = "pr"):
    """Generate a pipeline for integration tests.

    Args:
      trigger: controls which events can trigger the pipeline execution.
      prefix: used in the naming of the pipeline.
      ver_mode: defines the event / origin of this build. In this function, if it is set to pr, then it will attempt to clone grafana-enterprise. Otherwise it has no effect.

    Returns:
      Drone pipeline.
    """
    environment = {"EDITION": "oss"}

    services = integration_test_services()
    volumes = integration_test_services_volumes()

    init_steps = []

    verify_step = verify_gen_cue_step()
    verify_jsonnet_step = verify_gen_jsonnet_step()

    if ver_mode == "pr":
        # In pull requests, attempt to clone grafana enterprise.
        init_steps.append(github_app_generate_token_step())
        init_steps.append(enterprise_setup_step())

        volumes += github_app_pipeline_volumes()

    init_steps += [
        download_grabpl_step(),
        compile_build_cmd(),
        identify_runner_step(),
        verify_step,
        verify_jsonnet_step,
        wire_install_step(),
    ]

    # test_steps = [a, b] + [c, d] + [e, f]...
    test_steps = postgres_integration_tests_steps() + \
                 mysql_integration_tests_steps("mysql80", "8.0") + \
                 redis_integration_tests_steps() + \
                 memcached_integration_tests_steps() + \
                 remote_alertmanager_integration_tests_steps()

    return pipeline(
        name = "{}-integration-tests".format(prefix),
        trigger = trigger,
        environment = environment,
        services = services,
        volumes = volumes,
        steps = init_steps + test_steps,
    )
