"""
This module returns the pipeline used for integration benchmarks.
"""

load(
    "scripts/drone/steps/lib.star",
    "compile_build_cmd",
    "identify_runner_step",
    "enterprise_setup_step",
    "verify_gen_cue_step",
    "verify_gen_jsonnet_step",
    "wire_install_step",
    "build_image",
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

def integration_benchmarks(trigger, prefix):
    """Generate a pipeline for integration tests.

    Args:
      trigger: controls which events can trigger the pipeline execution.
      prefix: used in the naming of the pipeline.

    Returns:
      Drone pipeline.
    """
    environment = {"EDITION": "oss"}

    # In pull requests, attempt to clone grafana enterprise.
    init_steps = [enterprise_setup_step()]
    
    verify_step = verify_gen_cue_step()
    verify_jsonnet_step = verify_gen_jsonnet_step()
    
    services = integration_test_services(edition = "oss")
    volumes = integration_test_services_volumes()
    
    # Ensure that verif_gen_cue happens after we clone enterprise
    # At the time of writing this, very_gen_cue is depended on by the wire step which is what everything else depends on.
    verify_step["depends_on"].append("clone-enterprise")
    verify_jsonnet_step["depends_on"].append("clone-enterprise")
    
    init_steps += [
    	compile_build_cmd(),
    	#identify_runner_step(),
    	verify_step,
    	verify_jsonnet_step,
    	wire_install_step(),
    ]
    
    cmd = ["go test -run=^$ -timeout=20m -bench=. -benchtime=5s -benchmem ./pkg/services/sqlstore/permissions"]
    
    benchmark_steps = [
    	{
    		"name": "sqlite-integration-benchmarks",
    		"image": build_image,
    		"depends_on": ["wire-install"],
    		"commands": cmd
    	},
    	{
    		"name": "postgres-integration-benchmarks",
    		"image": build_image,
    		"depends_on": ["wire-install"],
    		"environment": {
    		    "PGPASSWORD": "grafanatest",
    		    "GRAFANA_TEST_DB": "postgres",
    		    "POSTGRES_HOST": "postgres",
    		},
    		"commands": cmd
    	},
    	{
    		"name": "mysql-integration-benchmarks",
    		"image": build_image,
    		"depends_on": ["wire-install"],
    		"environment": {
    		    "GRAFANA_TEST_DB": "mysql",
    		    "MYSQL_HOST": "mysql",
    		},
    		"commands": cmd,
    	},
	{
    		"name": "mysql8-integration-benchmarks",
    		"image": build_image,
    		"depends_on": ["wire-install"],
    		"environment": {
    		    "GRAFANA_TEST_DB": "mysql",
    		    "MYSQL_HOST": "mysql-8",
    		},
    		"commands": cmd,
    	}
    ]
    
    return pipeline(
    	name = "{}-integration-benchmarks".format(prefix),
    	edition = "oss",
    	trigger = trigger,
    	environment = environment,
    	services = services,
    	volumes = volumes,
    	steps = init_steps + benchmark_steps,
    )
