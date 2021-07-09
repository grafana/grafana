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
    'gen_version_step',
    'package_step',
    'e2e_tests_server_step',
    'e2e_tests_step',
    'build_storybook_step',
    'build_frontend_docs_step',
    'copy_packages_for_docker_step',
    'build_docker_images_step',
    'postgres_integration_tests_step',
    'mysql_integration_tests_step',
    'redis_integration_tests_step',
    'memcached_integration_tests_step',
    'get_windows_steps',
    'benchmark_ldap_step',
    'ldap_service',
    'enterprise_downstream_step',
    'frontend_metrics_step',
    'publish_storybook_step',
    'release_canary_npm_packages_step',
    'upload_packages_step',
    'push_to_deployment_tools_step',
    'publish_packages_step',
    'notify_pipeline',
    'integration_test_services',
    'upload_cdn',
    'validate_scuemata'
)

ver_mode = 'main'

def get_steps(edition, is_downstream=False):
    publish = edition != 'enterprise' or is_downstream
    include_enterprise2 = edition == 'enterprise'
    steps = [
        enterprise_downstream_step(edition=edition),
        codespell_step(),
        shellcheck_step(),
        test_backend_step(edition=edition),
        lint_backend_step(edition=edition),
        test_frontend_step(),
        build_backend_step(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream),
        build_frontend_step(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream),
        build_plugins_step(edition=edition, sign=True),
        validate_scuemata(),
    ]

    # Have to insert Enterprise2 steps before they're depended on (in the gen-version step)
    if include_enterprise2:
        edition2 = 'enterprise2'
        steps.extend([
            test_backend_step(edition=edition2),
            lint_backend_step(edition=edition2),
            build_backend_step(edition=edition2, ver_mode=ver_mode, variants=['linux-x64'], is_downstream=is_downstream),
        ])

    # Insert remaining steps
    steps.extend([
        gen_version_step(ver_mode=ver_mode, is_downstream=is_downstream, include_enterprise2=include_enterprise2),
        package_step(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream),
        e2e_tests_server_step(edition=edition),
        e2e_tests_step(edition=edition),
        build_storybook_step(edition=edition, ver_mode=ver_mode),
        publish_storybook_step(edition=edition, ver_mode=ver_mode),
        frontend_metrics_step(edition=edition),
        build_frontend_docs_step(edition=edition),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition=edition, ver_mode=ver_mode, publish=publish),
        build_docker_images_step(edition=edition, ver_mode=ver_mode, ubuntu=True, publish=publish),
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
    ])

    if include_enterprise2:
      steps.extend([redis_integration_tests_step(), memcached_integration_tests_step()])

    steps.extend([
        release_canary_npm_packages_step(edition),
        upload_packages_step(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream),
        push_to_deployment_tools_step(edition=edition, is_downstream=is_downstream),
        upload_cdn(edition=edition)
    ])

    if include_enterprise2:
        edition2 = 'enterprise2'
        steps.extend([
            package_step(edition=edition2, ver_mode=ver_mode, variants=['linux-x64'], is_downstream=is_downstream),
            e2e_tests_server_step(edition=edition2, port=3002),
            e2e_tests_step(edition=edition2, port=3002),
            upload_packages_step(edition=edition2, ver_mode=ver_mode, is_downstream=is_downstream),
            upload_cdn(edition=edition2)
        ])

    windows_steps = get_windows_steps(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream)
    if edition == 'enterprise' and not is_downstream:
        publish_steps = []
    else:
        publish_steps = [
            publish_packages_step(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream),
        ]

    return steps, windows_steps, publish_steps

def main_pipelines(edition):
    services = integration_test_services(edition)
    trigger = {
        'event': ['push',],
        'branch': 'main',
    }
    steps, windows_steps, publish_steps = get_steps(edition=edition)

    if edition == 'enterprise':
        steps.append(benchmark_ldap_step())
        services.append(ldap_service())

    pipelines = [
        pipeline(
            name='build-main', edition=edition, trigger=trigger, services=services, steps=steps,
            ver_mode=ver_mode,
        ),
        pipeline(
            name='windows-main', edition=edition, trigger=trigger, steps=windows_steps, platform='windows',
            depends_on=['build-main'], ver_mode=ver_mode,
        ),
    ]
    if edition != 'enterprise':
        pipelines.append(pipeline(
            name='publish-main', edition=edition, trigger=trigger, steps=publish_steps,
            depends_on=['build-main', 'windows-main',], install_deps=False, ver_mode=ver_mode,
        ))

        pipelines.append(notify_pipeline(
            name='notify-main', slack_channel='grafana-ci-notifications', trigger=trigger,
            depends_on=['build-main', 'windows-main', 'publish-main'],
        ))
    else:
        # Add downstream enterprise pipelines triggerable from OSS builds
        trigger = {
            'event': ['custom',],
        }
        steps, windows_steps, publish_steps = get_steps(edition=edition, is_downstream=True)
        pipelines.append(pipeline(
            name='build-main-downstream', edition=edition, trigger=trigger, services=services, steps=steps,
            is_downstream=True, ver_mode=ver_mode,
        ))
        pipelines.append(pipeline(
            name='windows-main-downstream', edition=edition, trigger=trigger, steps=windows_steps,
            platform='windows', depends_on=['build-main-downstream'], is_downstream=True, ver_mode=ver_mode,
        ))
        pipelines.append(pipeline(
            name='publish-main-downstream', edition=edition, trigger=trigger, steps=publish_steps,
            depends_on=['build-main-downstream', 'windows-main-downstream'], is_downstream=True, install_deps=False,
            ver_mode=ver_mode,
        ))

        pipelines.append(notify_pipeline(
            name='notify-main-downstream', slack_channel='grafana-enterprise-ci-notifications', trigger=trigger,
            depends_on=['build-main-downstream', 'windows-main-downstream', 'publish-main-downstream'],
        ))

    return pipelines
