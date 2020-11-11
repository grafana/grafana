load(
    'scripts/lib.star',
    'pipeline',
    'lint_backend_step',
    'codespell_step',
    'shellcheck_step',
    'test_backend_step',
    'test_frontend_step',
    'build_backend_step',
    'build_frontend_step',
    'build_plugins_step',
    'package_step',
    'e2e_tests_server_step',
    'e2e_tests_step',
    'build_storybook_step',
    'build_frontend_docs_step',
    'copy_packages_for_docker_step',
    'build_docker_images_step',
    'postgres_integration_tests_step',
    'mysql_integration_tests_step',
    'get_windows_steps',
    'benchmark_ldap_step',
    'ldap_service',
    'enterprise_downstream_step',
    'frontend_metrics_step',
    'publish_storybook_step',
    'release_next_npm_packages_step',
    'upload_packages_step',
    'deploy_to_kubernetes_step',
    'publish_packages_step',
    'notify_pipeline',
    'integration_test_services',
)

ver_mode = 'master'

def get_steps(edition, is_downstream=False):
    publish = edition != 'enterprise' or is_downstream
    steps = [
        enterprise_downstream_step(edition),
        lint_backend_step(edition),
        codespell_step(),
        shellcheck_step(),
        test_backend_step(),
        test_frontend_step(),
        frontend_metrics_step(edition=edition),
        build_backend_step(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream),
        build_frontend_step(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream),
        build_plugins_step(edition=edition, sign=True),
        package_step(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream),
        e2e_tests_server_step(),
        e2e_tests_step(),
        build_storybook_step(edition=edition, ver_mode=ver_mode),
        publish_storybook_step(edition=edition, ver_mode=ver_mode),
        build_frontend_docs_step(edition=edition),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition=edition, ver_mode=ver_mode, publish=publish),
        build_docker_images_step(edition=edition, ver_mode=ver_mode, ubuntu=True, publish=publish),
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
        release_next_npm_packages_step(edition),
        upload_packages_step(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream),
        deploy_to_kubernetes_step(edition=edition, is_downstream=is_downstream),
    ]
    windows_steps = get_windows_steps(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream)

    publish_steps = [
        publish_packages_step(edition=edition, is_downstream=is_downstream),
    ]

    return steps, windows_steps, publish_steps

def master_pipelines(edition):
    services = integration_test_services()
    trigger = {
        'event': ['push',],
        'branch': 'master',
    }
    steps, windows_steps, publish_steps = get_steps(edition=edition)

    if edition == 'enterprise':
        steps.append(benchmark_ldap_step())
        services.append(ldap_service())

    pipelines = [
        pipeline(
            name='build-master', edition=edition, trigger=trigger, services=services, steps=steps,
            ver_mode=ver_mode,
        ),
        pipeline(
            name='windows-master', edition=edition, trigger=trigger, steps=windows_steps, platform='windows',
            depends_on=['build-master'], ver_mode=ver_mode,
        ),
    ]
    if edition != 'enterprise':
        pipelines.append(pipeline(
            name='publish-master', edition=edition, trigger=trigger, steps=publish_steps,
            depends_on=['build-master', 'windows-master',], install_deps=False, ver_mode=ver_mode,
        ))

        pipelines.append(notify_pipeline(
            name='notify-master', slack_channel='grafana-ci-notifications', trigger=trigger,
            depends_on=['build-master', 'windows-master', 'publish-master'],
        ))
    else:
        # Add downstream enterprise pipelines triggerable from OSS builds
        trigger = {
            'event': ['custom',],
        }
        steps, windows_steps, publish_steps = get_steps(edition=edition, is_downstream=True)
        pipelines.append(pipeline(
            name='build-master-downstream', edition=edition, trigger=trigger, services=services, steps=steps,
            is_downstream=True, ver_mode=ver_mode,
        ))
        pipelines.append(pipeline(
            name='windows-master-downstream', edition=edition, trigger=trigger, steps=windows_steps,
            platform='windows', depends_on=['build-master-downstream'], is_downstream=True, ver_mode=ver_mode,
        ))
        pipelines.append(pipeline(
            name='publish-master-downstream', edition=edition, trigger=trigger, steps=publish_steps,
            depends_on=['build-master-downstream', 'windows-master-downstream'], is_downstream=True, install_deps=False,
            ver_mode=ver_mode,
        ))

        pipelines.append(notify_pipeline(
            name='notify-master-downstream', slack_channel='grafana-enterprise-ci-notifications', trigger=trigger,
            depends_on=['build-master-downstream', 'windows-master-downstream', 'publish-master-downstream'],
        ))

    return pipelines
