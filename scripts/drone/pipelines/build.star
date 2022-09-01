load(
    'scripts/drone/steps/lib.star',
    'download_grabpl_step',
    'build_image',
    'identify_runner_step',
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
    'upload_cdn_step',
    'verify_gen_cue_step',
    'test_a11y_frontend_step',
    'trigger_oss',
    'betterer_frontend_step',
    'trigger_test_release',
    'compile_build_cmd',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)

def build_e2e(trigger, ver_mode, edition):
    variants = ['linux-amd64', 'linux-amd64-musl', 'darwin-amd64', 'windows-amd64',]
    init_steps = [
        identify_runner_step(),
        download_grabpl_step(),
        compile_build_cmd(),
        verify_gen_cue_step(edition="oss"),
        wire_install_step(),
        yarn_install_step(),
    ]
    build_steps = []
    if ver_mode == 'main':
        build_steps.extend([trigger_test_release()])
    build_steps.extend([
        enterprise_downstream_step(edition=edition, ver_mode=ver_mode),
        build_backend_step(edition=edition, ver_mode=ver_mode),
        build_frontend_step(edition=edition, ver_mode=ver_mode),
        build_frontend_package_step(edition=edition, ver_mode=ver_mode),
        build_plugins_step(edition=edition, ver_mode=ver_mode),
   ])
    if ver_mode == 'main':
        build_steps.extend([package_step(edition=edition, ver_mode=ver_mode)])
    elif ver_mode == 'pr':
        build_steps.extend([package_step(edition=edition, ver_mode=ver_mode, variants=variants)])

    build_steps.extend([
        grafana_server_step(edition=edition),
        e2e_tests_step('dashboards-suite', edition=edition),
        e2e_tests_step('smoke-tests-suite', edition=edition),
        e2e_tests_step('panels-suite', edition=edition),
        e2e_tests_step('various-suite', edition=edition),
        e2e_tests_artifacts(edition=edition),
        build_storybook_step(edition=edition, ver_mode=ver_mode),
        copy_packages_for_docker_step(),
        test_a11y_frontend_step(ver_mode=ver_mode, edition=edition),
    ])
    if ver_mode == 'main':
        build_steps.extend([
            store_storybook_step(edition=edition, ver_mode=ver_mode, trigger=trigger_oss),
            frontend_metrics_step(edition=edition, trigger=trigger_oss)
        ])

    if ver_mode == 'main':
        build_steps.extend([
            build_docker_images_step(edition=edition, ver_mode=ver_mode, publish=False),
            build_docker_images_step(edition=edition, ver_mode=ver_mode, ubuntu=True, publish=False),
            publish_images_step(edition=edition, ver_mode=ver_mode, mode='', docker_repo='grafana', trigger=trigger_oss),
            publish_images_step(edition=edition, ver_mode=ver_mode, mode='', docker_repo='grafana-oss', trigger=trigger_oss),
            release_canary_npm_packages_step(edition, trigger=trigger_oss),
            upload_packages_step(edition=edition, ver_mode=ver_mode, trigger=trigger_oss),
            upload_cdn_step(edition=edition, ver_mode=ver_mode, trigger=trigger_oss)
        ])
    elif ver_mode == 'pr':
        build_steps.extend([build_docker_images_step(edition=edition, ver_mode=ver_mode, archs=['amd64', ])])

    publish_suffix = ''
    if ver_mode == 'main':
        publish_suffix = '-publish'

    return pipeline(
        name='{}-build-e2e{}'.format(ver_mode, publish_suffix), edition="oss", trigger=trigger, services=[], steps=init_steps + build_steps,
    )
