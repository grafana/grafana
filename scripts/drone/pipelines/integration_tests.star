load(
    'scripts/drone/steps/lib.star',
    'compile_build_cmd',
    'download_grabpl_step',
    'identify_runner_step',
    'verify_gen_cue_step',
    'verify_gen_jsonnet_step',
    'wire_install_step',
    'postgres_integration_tests_step',
    'mysql_integration_tests_step',
)

load(
    'scripts/drone/services/services.star',
    'integration_test_services',
    'integration_test_services_volumes',
    'ldap_service',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)


def integration_tests(trigger, prefix):
    services = integration_test_services(edition="oss")
    volumes = integration_test_services_volumes()

    environment = {'EDITION': 'oss'}

    init_steps = [
        download_grabpl_step(),
        compile_build_cmd(),
        identify_runner_step(),
        verify_gen_cue_step(),
        verify_gen_jsonnet_step(),
        wire_install_step(),
    ]

    test_steps = [
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
    ]

    return pipeline(
        name='{}-integration-tests'.format(prefix),
        edition='oss',
        trigger=trigger,
        environment=environment,
        services=services,
        volumes=volumes,
        steps=init_steps + test_steps,
    )
