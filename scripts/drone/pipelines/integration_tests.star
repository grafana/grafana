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
    'enterprise_setup_step',
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
    'external_name',
)


def integration_tests(trigger, prefix, ver_mode='pr', external=False):
    environment = {'EDITION': 'oss'}

    services = integration_test_services(edition="oss")
    volumes = integration_test_services_volumes()


    init_steps = []

    verify_step = verify_gen_cue_step()

    if ver_mode == 'pr' and not external:
        # In pull requests, attempt to clone grafana enterprise.
        init_steps.append(enterprise_setup_step(location='../grafana-enterpise'))
        # Ensure that verif_gen_cue happens after we clone enterprise
        # At the time of writing this, very_gen_cue is depended on by the wire step which is what everything else depends on.
        verify_step['depends_on'] += ['clone-enterprise']

    init_steps += [
        download_grabpl_step(),
        compile_build_cmd(),
        identify_runner_step(),
        verify_step,
        verify_gen_jsonnet_step(),
        wire_install_step(),
    ]

    test_steps = [
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
    ]

    return pipeline(
        name=external_name('{}-integration-tests'.format(prefix), external),
        edition='oss',
        trigger=trigger,
        environment=environment,
        services=services,
        volumes=volumes,
        steps=init_steps + test_steps,
    )
