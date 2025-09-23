"""
This module returns the pipeline used for integration benchmarks.
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
    "enterprise_setup_step",
    "integration_benchmarks_step",
    "verify_gen_cue_step",
    "verify_gen_jsonnet_step",
    "wire_install_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

def integration_benchmarks(prefix):
    """Generate a pipeline for integration tests.

    Args:
      prefix: used in the naming of the pipeline.
    Returns:
      Drone pipeline.
    """
    environment = {"EDITION": "oss"}

    services = integration_test_services()
    volumes = integration_test_services_volumes() + github_app_pipeline_volumes()

    # In pull requests, attempt to clone grafana enterprise.
    init_steps = [
        github_app_generate_token_step(),
        enterprise_setup_step(isPromote = True),
    ]

    verify_step = verify_gen_cue_step()
    verify_jsonnet_step = verify_gen_jsonnet_step()

    # Ensure that verif_gen_cue happens after we clone enterprise
    # At the time of writing this, very_gen_cue is depended on by the wire step which is what everything else depends on.
    verify_step["depends_on"].append("clone-enterprise")
    verify_jsonnet_step["depends_on"].append("clone-enterprise")

    init_steps += [
        compile_build_cmd(),
        verify_step,
        verify_jsonnet_step,
        wire_install_step(),
    ]

    benchmark_steps = integration_benchmarks_step("sqlite") + \
                      integration_benchmarks_step("postgres", {
                          "PGPASSWORD": "grafanatest",
                          "GRAFANA_TEST_DB": "postgres",
                          "POSTGRES_HOST": "postgres",
                      }) + \
                      integration_benchmarks_step("mysql-8.0", {
                          "GRAFANA_TEST_DB": "mysql",
                          "MYSQL_HOST": "mysql80",
                      })

    return pipeline(
        name = "{}-integration-benchmarks".format(prefix),
        trigger = {
            "event": ["promote"],
            "target": ["gobenchmarks"],
        },
        environment = environment,
        services = services,
        volumes = volumes,
        steps = init_steps + benchmark_steps,
    )
