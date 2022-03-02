load(
    'scripts/drone/steps/lib.star',
    'download_grabpl_step',
    'initialize_step',
    'lint_drone_step',
    'lint_backend_step',
    'lint_frontend_step',
    'codespell_step',
    'shellcheck_step',
    'test_backend_step',
    'test_backend_integration_step',
    'test_frontend_step',
    'build_backend_step',
    'build_frontend_step',
    'build_frontend_package_step',
    'build_plugins_step',
    'package_step',
    'grafana_server_step',
    'e2e_tests_step',
    'e2e_tests_artifacts',
    'build_storybook_step',
    'copy_packages_for_docker_step',
    'build_docker_images_step',
    'publish_images_step',
    'postgres_integration_tests_step',
    'mysql_integration_tests_step',
    'redis_integration_tests_step',
    'memcached_integration_tests_step',
    'get_windows_steps',
    'benchmark_ldap_step',
    'enterprise_downstream_step',
    'frontend_metrics_step',
    'store_storybook_step',
    'release_canary_npm_packages_step',
    'upload_packages_step',
    'store_packages_step',
    'upload_cdn_step',
    'validate_scuemata_step',
    'ensure_cuetsified_step',
    'test_a11y_frontend_step'
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
    'notify_pipeline',
    'failure_template',
    'drone_change_template',
)

load(
    'scripts/drone/pipelines/docs.star',
    'docs_pipelines',
)

ver_mode = 'main'

def get_steps(edition, is_downstream=False):
    services = integration_test_services(edition)
    publish = edition != 'enterprise' or is_downstream
    include_enterprise2 = edition == 'enterprise'
    test_steps = [
        lint_drone_step(),
        codespell_step(),
        shellcheck_step(),
        lint_backend_step(edition=edition),
        lint_frontend_step(),
        test_backend_step(edition=edition),
        test_backend_integration_step(edition=edition),
        test_frontend_step(),
    ]
    build_steps = [
        enterprise_downstream_step(edition=edition),
        build_backend_step(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream),
        build_frontend_step(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream),
        build_frontend_package_step(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream),
        build_plugins_step(edition=edition, sign=True),
        validate_scuemata_step(),
        ensure_cuetsified_step(),
    ]
    integration_test_steps = [
        postgres_integration_tests_step(edition=edition, ver_mode=ver_mode),
        mysql_integration_tests_step(edition=edition, ver_mode=ver_mode),
    ]

    if include_enterprise2:
        edition2 = 'enterprise2'
        build_steps.append(benchmark_ldap_step())
        services.append(ldap_service())
        test_steps.extend([
            lint_backend_step(edition=edition2),
            test_backend_step(edition=edition2),
            test_backend_integration_step(edition=edition2),
        ])
        build_steps.extend([
            build_backend_step(edition=edition2, ver_mode=ver_mode, variants=['linux-x64'], is_downstream=is_downstream),
        ])

    # Insert remaining steps
    build_steps.extend([
        package_step(edition=edition, ver_mode=ver_mode, include_enterprise2=include_enterprise2, is_downstream=is_downstream),
        grafana_server_step(edition=edition),
        e2e_tests_step('dashboards-suite', edition=edition),
        e2e_tests_step('smoke-tests-suite', edition=edition),
        e2e_tests_step('panels-suite', edition=edition),
        e2e_tests_step('various-suite', edition=edition),
        e2e_tests_artifacts(edition=edition),
        build_storybook_step(edition=edition, ver_mode=ver_mode),
        store_storybook_step(edition=edition, ver_mode=ver_mode),
        test_a11y_frontend_step(ver_mode=ver_mode, edition=edition),
        frontend_metrics_step(edition=edition),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition=edition, ver_mode=ver_mode, publish=False),
        build_docker_images_step(edition=edition, ver_mode=ver_mode, ubuntu=True, publish=False),
        publish_images_step(edition=edition, ver_mode=ver_mode, mode='', docker_repo='grafana', ubuntu=False),
        publish_images_step(edition=edition, ver_mode=ver_mode, mode='', docker_repo='grafana-oss', ubuntu=True)
    ])

    if include_enterprise2:
      integration_test_steps.extend([redis_integration_tests_step(edition=edition2, ver_mode=ver_mode), memcached_integration_tests_step(edition=edition2, ver_mode=ver_mode)])

    build_steps.extend([
        release_canary_npm_packages_step(edition),
        upload_packages_step(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream),
        upload_cdn_step(edition=edition, ver_mode=ver_mode)
    ])

    if include_enterprise2:
        edition2 = 'enterprise2'
        build_steps.extend([
            package_step(edition=edition2, ver_mode=ver_mode, include_enterprise2=include_enterprise2, variants=['linux-x64'], is_downstream=is_downstream),
            upload_packages_step(edition=edition2, ver_mode=ver_mode, is_downstream=is_downstream),
            upload_cdn_step(edition=edition2, ver_mode=ver_mode)
        ])

    windows_steps = get_windows_steps(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream)
    if edition == 'enterprise' and not is_downstream:
        store_steps = []
    else:
        store_steps = [
            store_packages_step(edition=edition, ver_mode=ver_mode, is_downstream=is_downstream),
        ]

    return test_steps, build_steps, integration_test_steps, windows_steps, store_steps

def main_pipelines(edition):
    services = integration_test_services(edition)
    volumes = integration_test_services_volumes()
    trigger = {
        'event': ['push',],
        'branch': 'main',
    }
    drone_change_trigger = {
        'event': ['push',],
        'branch': 'main',
        'paths': {
            'include': [
                '.drone.yml',
            ],
            'exclude': [
                'exclude',
            ],
        },
    }
    test_steps, build_steps, integration_test_steps, windows_steps, store_steps = get_steps(edition=edition)

    if edition == 'enterprise':
        services.append(ldap_service())
        integration_test_steps.append(benchmark_ldap_step())

    pipelines = [
        docs_pipelines(edition, ver_mode, trigger),
        pipeline(
            name='main-test', edition=edition, trigger=trigger, services=[],
            steps=[download_grabpl_step()] + initialize_step(edition, platform='linux', ver_mode=ver_mode) + test_steps,
            volumes=[],
        ),
        pipeline(
            name='main-build-e2e-publish', edition=edition, trigger=trigger, services=[],
            steps=[download_grabpl_step()] + initialize_step(edition, platform='linux', ver_mode=ver_mode) + build_steps,
            volumes=volumes,
        ),
        pipeline(
            name='main-integration-tests', edition=edition, trigger=trigger, services=services,
            steps=[download_grabpl_step()] + integration_test_steps,
            volumes=volumes,
        ),
        pipeline(
            name='windows-main', edition=edition, trigger=trigger,
            steps=initialize_step(edition, platform='windows', ver_mode=ver_mode) + windows_steps,
            depends_on=['main-test', 'main-build-e2e-publish', 'main-integration-tests'], platform='windows',
        ), notify_pipeline(
            name='notify-drone-changes', slack_channel='slack-webhooks-test', trigger=drone_change_trigger, template=drone_change_template, secret='drone-changes-webhook',
        ),
    ]
    if edition != 'enterprise':
        pipelines.append(pipeline(
            name='publish-main', edition=edition, trigger=trigger,
            steps=[download_grabpl_step()] + initialize_step(edition, platform='linux', ver_mode=ver_mode, install_deps=False) + store_steps,
            depends_on=['main-test', 'main-build-e2e-publish', 'main-integration-tests', 'windows-main',],
        ))

        pipelines.append(notify_pipeline(
            name='notify-main', slack_channel='grafana-ci-notifications', trigger=dict(trigger, status = ['failure']),
            depends_on=['main-test', 'main-build-e2e-publish', 'main-integration-tests', 'windows-main', 'publish-main'], template=failure_template, secret='slack_webhook'
        ))
    else:
        # Add downstream enterprise pipelines triggerable from OSS builds
        trigger = {
            'event': ['custom',],
        }
        test_steps, build_steps, integration_test_steps, windows_steps, store_steps = get_steps(edition=edition, is_downstream=True)
        pipelines.append(pipeline(
            name='build-main-downstream', edition=edition, trigger=trigger, services=services,
            steps=[download_grabpl_step()] + initialize_step(edition, platform='linux', ver_mode=ver_mode, is_downstream=True) + test_steps + build_steps + integration_test_steps,
            volumes=volumes,
        ))
        pipelines.append(pipeline(
            name='windows-main-downstream', edition=edition, trigger=trigger,
            steps=[download_grabpl_step()] + initialize_step(edition, platform='windows', ver_mode=ver_mode, is_downstream=True) + windows_steps,
            platform='windows', depends_on=['build-main-downstream'],
        ))
        pipelines.append(pipeline(
            name='publish-main-downstream', edition=edition, trigger=trigger,
            steps=[download_grabpl_step()] + initialize_step(edition, platform='linux', ver_mode=ver_mode, is_downstream=True, install_deps=False) + store_steps,
            depends_on=['build-main-downstream', 'windows-main-downstream'],
        ))

        pipelines.append(notify_pipeline(
            name='notify-main-downstream', slack_channel='grafana-enterprise-ci-notifications', trigger=dict(trigger, status = ['failure']),
            depends_on=['build-main-downstream', 'windows-main-downstream', 'publish-main-downstream'], template=failure_template, secret='slack_webhook',
        ))

    return pipelines
