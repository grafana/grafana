load(
    'scripts/drone/steps/lib.star',
    'download_grabpl_step',
    'build_image',
    'identify_runner_step',
    'gen_version_step',
    'wire_install_step',
    'yarn_install_step',
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
    'test_a11y_frontend_step',
    'trigger_oss'
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

load('scripts/drone/vault.star', 'from_secret')


ver_mode = 'main'

def get_steps(edition):
    services = integration_test_services(edition)
    include_enterprise2 = edition == 'enterprise'
    init_steps = [
        identify_runner_step(),
        download_grabpl_step(),
        gen_version_step(ver_mode),
        wire_install_step(),
        yarn_install_step(),
    ]
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
        trigger_test_release(),
        enterprise_downstream_step(edition=edition),
        build_backend_step(edition=edition, ver_mode=ver_mode),
        build_frontend_step(edition=edition, ver_mode=ver_mode),
        build_frontend_package_step(edition=edition, ver_mode=ver_mode),
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
            build_backend_step(edition=edition2, ver_mode=ver_mode, variants=['linux-amd64']),
        ])

    # Insert remaining steps
    build_steps.extend([
        package_step(edition=edition, ver_mode=ver_mode, include_enterprise2=include_enterprise2),
        grafana_server_step(edition=edition),
        e2e_tests_step('dashboards-suite', edition=edition),
        e2e_tests_step('smoke-tests-suite', edition=edition),
        e2e_tests_step('panels-suite', edition=edition),
        e2e_tests_step('various-suite', edition=edition),
        e2e_tests_artifacts(edition=edition),
        build_storybook_step(edition=edition, ver_mode=ver_mode),
        store_storybook_step(edition=edition, ver_mode=ver_mode, trigger=trigger_oss),
        test_a11y_frontend_step(ver_mode=ver_mode, edition=edition),
        frontend_metrics_step(edition=edition, trigger=trigger_oss),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition=edition, ver_mode=ver_mode, publish=False),
        build_docker_images_step(edition=edition, ver_mode=ver_mode, ubuntu=True, publish=False),
        publish_images_step(edition=edition, ver_mode=ver_mode, mode='', docker_repo='grafana', trigger=trigger_oss),
        publish_images_step(edition=edition, ver_mode=ver_mode, mode='', docker_repo='grafana-oss', trigger=trigger_oss)
    ])

    if include_enterprise2:
      integration_test_steps.extend([redis_integration_tests_step(edition=edition2, ver_mode=ver_mode), memcached_integration_tests_step(edition=edition2, ver_mode=ver_mode)])

    build_steps.extend([
        release_canary_npm_packages_step(edition, trigger=trigger_oss),
        upload_packages_step(edition=edition, ver_mode=ver_mode, trigger=trigger_oss),
        upload_cdn_step(edition=edition, ver_mode=ver_mode, trigger=trigger_oss)
    ])

    if include_enterprise2:
        edition2 = 'enterprise2'
        build_steps.extend([
            package_step(edition=edition2, ver_mode=ver_mode, include_enterprise2=include_enterprise2, variants=['linux-amd64']),
            upload_packages_step(edition=edition2, ver_mode=ver_mode),
            upload_cdn_step(edition=edition2, ver_mode=ver_mode)
        ])

    windows_steps = get_windows_steps(edition=edition, ver_mode=ver_mode)
    if edition == 'enterprise':
        store_steps = []
    else:
        store_steps = [
            store_packages_step(edition=edition, ver_mode=ver_mode),
        ]

    return init_steps, test_steps, build_steps, integration_test_steps, windows_steps, store_steps

def trigger_test_release():
    return {
        'name': 'trigger-test-release',
        'image': build_image,
        'environment': {
            'GITHUB_TOKEN': from_secret('github_token'),
            'DOWNSTREAM_REPO': from_secret('downstream'),
            'TEST_TAG': 'v0.0.0-test',
        },
        'commands': [
            'git clone "https://$${GITHUB_TOKEN}@github.com/grafana/grafana-enterprise.git" --depth=1',
            'cd grafana-enterprise',
            'git fetch origin "refs/tags/*:refs/tags/*"',
            'git tag -d $${TEST_TAG} && git push --delete origin $${TEST_TAG} && git tag $${TEST_TAG} && git push origin $${TEST_TAG}',
            'cd -',
            'git fetch origin "refs/tags/*:refs/tags/*"',
            'git remote add downstream https://$${GITHUB_TOKEN}@github.com/grafana/$${DOWNSTREAM_REPO}.git',
            'git tag -d $${TEST_TAG} && git push --delete downstream --quiet $${TEST_TAG} && git tag $${TEST_TAG} && git push downstream $${TEST_TAG} --quiet',
        ],
        'failure': 'ignore',
        'when': {
            'paths': {
                'include': [
                    '.drone.yml',
                ]
            },
            'repo': [
                'grafana/grafana',
            ]
        }
    }

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
        'repo': [
            'grafana/grafana',
        ],
        'paths': {
            'include': [
                '.drone.yml',
            ],
            'exclude': [
                'exclude',
            ],
        },
    }
    init_steps, test_steps, build_steps, integration_test_steps, windows_steps, store_steps = get_steps(edition=edition)

    if edition == 'enterprise':
        services.append(ldap_service())
        integration_test_steps.append(benchmark_ldap_step())

    pipelines = [docs_pipelines(edition, ver_mode, trigger), pipeline(
        name='main-test', edition=edition, trigger=trigger, services=[],
        steps=init_steps + test_steps,
        volumes=[],
    ), pipeline(
        name='main-build-e2e-publish', edition=edition, trigger=trigger, services=[],
        steps=init_steps + build_steps,
        volumes=volumes,
    ), pipeline(
        name='main-integration-tests', edition=edition, trigger=trigger, services=services,
        steps=[download_grabpl_step(), identify_runner_step(),] + integration_test_steps,
        volumes=volumes,
    ), pipeline(
        name='main-windows', edition=edition, trigger=dict(trigger, repo=['grafana/grafana']),
        steps=[identify_runner_step('windows')] + windows_steps,
        depends_on=['main-test', 'main-build-e2e-publish', 'main-integration-tests'], platform='windows',
    ), notify_pipeline(
        name='notify-drone-changes', slack_channel='slack-webhooks-test', trigger=drone_change_trigger,
        template=drone_change_template, secret='drone-changes-webhook',
    ), pipeline(
        name='main-publish', edition=edition, trigger=dict(trigger, repo=['grafana/grafana']),
        steps=[download_grabpl_step(), identify_runner_step(),] + store_steps,
        depends_on=['main-test', 'main-build-e2e-publish', 'main-integration-tests', 'main-windows', ],
    ), notify_pipeline(
        name='main-notify', slack_channel='grafana-ci-notifications', trigger=dict(trigger, status=['failure']),
        depends_on=['main-test', 'main-build-e2e-publish', 'main-integration-tests', 'main-windows', 'main-publish'],
        template=failure_template, secret='slack_webhook'
    )]

    return pipelines
