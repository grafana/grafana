load(
    'scripts/drone/steps/lib.star',
    'download_grabpl_step',
    'build_image',
    'identify_runner_step',
    'gen_version_step',
    'wire_install_step',
    'yarn_install_step',
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
    'verify_gen_cue_step',
    'test_a11y_frontend_step',
    'trigger_oss',
    'betterer_frontend_step',
    'trigger_test_release'
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

load(
    'scripts/drone/pipelines/test_frontend.star',
    'test_frontend',
)

load(
    'scripts/drone/pipelines/test_backend.star',
    'test_backend',
)

load(
    'scripts/drone/pipelines/integration_tests.star',
    'integration_tests',
)

load(
    'scripts/drone/pipelines/build.star',
    'build_e2e',
)

load('scripts/drone/vault.star', 'from_secret')


ver_mode = 'main'
trigger = {
    'event': ['push',],
    'branch': 'main',
}


def get_steps(edition):
    init_steps = [
        identify_runner_step(),
        download_grabpl_step(),
        gen_version_step(ver_mode),
        verify_gen_cue_step(edition="oss"),
        wire_install_step(),
        yarn_install_step(),
    ]
    build_steps = [
        trigger_test_release(),
        enterprise_downstream_step(edition=edition, ver_mode=ver_mode),
        build_backend_step(edition=edition, ver_mode=ver_mode),
        build_frontend_step(edition=edition, ver_mode=ver_mode),
        build_frontend_package_step(edition=edition, ver_mode=ver_mode),
        build_plugins_step(edition=edition, ver_mode=ver_mode),
    ]

    # Insert remaining steps
    build_steps.extend([
        package_step(edition=edition, ver_mode=ver_mode),
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

    build_steps.extend([
        release_canary_npm_packages_step(edition, trigger=trigger_oss),
        upload_packages_step(edition=edition, ver_mode=ver_mode, trigger=trigger_oss),
        upload_cdn_step(edition=edition, ver_mode=ver_mode, trigger=trigger_oss)
    ])

    windows_steps = get_windows_steps(edition=edition, ver_mode=ver_mode)
    store_steps = [store_packages_step(edition=edition, ver_mode=ver_mode),]

    return init_steps, windows_steps, store_steps

def main_pipelines(edition):
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
    init_steps, windows_steps, store_steps = get_steps(edition=edition)

    pipelines = [docs_pipelines(edition, ver_mode, trigger), test_frontend(trigger, ver_mode), test_backend(trigger, ver_mode),
    build_e2e(trigger, ver_mode, edition),
    integration_tests(trigger, ver_mode, edition),
    pipeline(
        name='main-windows', edition=edition, trigger=dict(trigger, repo=['grafana/grafana']),
        steps=[identify_runner_step('windows')] + windows_steps,
        depends_on=['main-test-frontend', 'main-test-backend', 'main-build-e2e-publish', 'main-integration-tests'], platform='windows',
    ), notify_pipeline(
        name='notify-drone-changes', slack_channel='slack-webhooks-test', trigger=drone_change_trigger,
        template=drone_change_template, secret='drone-changes-webhook',
    ), pipeline(
        name='main-publish', edition=edition, trigger=dict(trigger, repo=['grafana/grafana']),
        steps=[download_grabpl_step(), gen_version_step(ver_mode), identify_runner_step(),] + store_steps,
        depends_on=['main-test-frontend', 'main-test-backend', 'main-build-e2e-publish', 'main-integration-tests', 'main-windows', ],
    ), notify_pipeline(
        name='main-notify', slack_channel='grafana-ci-notifications', trigger=dict(trigger, status=['failure']),
        depends_on=['main-test-frontend', 'main-test-backend', 'main-build-e2e-publish', 'main-integration-tests', 'main-windows', 'main-publish'],
        template=failure_template, secret='slack_webhook'
    )]

    return pipelines
