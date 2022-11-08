load(
    'scripts/drone/steps/lib.star',
    'identify_runner_step',
    'download_grabpl_step',
    'verify_gen_cue_step',
    'verify_gen_jsonnet_step',
    'wire_install_step',
    'postgres_integration_tests_step',
    'mysql_integration_tests_step',
    'compile_build_cmd',
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

def integration_tests(trigger, ver_mode, edition):
    services = integration_test_services(edition)
    volumes = integration_test_services_volumes()
    init_steps = [
        download_grabpl_step(),
        compile_build_cmd(),
        identify_runner_step(),
        verify_gen_cue_step(edition="oss"),
        verify_gen_jsonnet_step(edition="oss"),
        wire_install_step(),
    ]
    test_steps = [
        postgres_integration_tests_step(edition=edition, ver_mode=ver_mode),
        mysql_integration_tests_step(edition=edition, ver_mode=ver_mode),
    ]

    return pipeline(
        name='{}-integration-tests'.format(ver_mode), edition="oss", trigger=trigger, services=services, steps=init_steps + test_steps,
        volumes=volumes
    )
