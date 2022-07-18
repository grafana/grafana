load(
    'scripts/drone/steps/lib.star',
    'download_grabpl_step',
    'gen_version_step',
    'yarn_install_step',
    'wire_install_step',
    'identify_runner_step',
    'lint_drone_step',
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
    'postgres_integration_tests_step',
    'mysql_integration_tests_step',
    'redis_integration_tests_step',
    'memcached_integration_tests_step',
    'benchmark_ldap_step',
    'verify_gen_cue_step',
    'test_a11y_frontend_step',
    'enterprise_downstream_step',
    'betterer_frontend_step',
)

load(
    'scripts/drone/utils/utils.star',
    'notify_pipeline',
    'pipeline',
    'failure_template',
    'drone_change_template',
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

load(
    'scripts/drone/pipelines/verify_drone.star',
    'verify_drone',
)

load(
    'scripts/drone/pipelines/docs.star',
    'docs_pipelines',
    'trigger_docs',
)

ver_mode = 'pr'
trigger = {
    'event': [
        'pull_request',
    ],
    'paths': {
        'exclude': [
            '*.md',
            'docs/**',
            'latest.json',
        ],
    },
}


def pr_pipelines(edition):
    variants = ['linux-amd64', 'linux-amd64-musl', 'darwin-amd64', 'windows-amd64',]
    init_steps = [
        identify_runner_step(),
        download_grabpl_step(),
        gen_version_step(ver_mode),
        verify_gen_cue_step(edition="oss"),
        wire_install_step(),
        yarn_install_step(),
    ]

    return [
        verify_drone(get_pr_trigger(include_paths=['scripts/drone/**', '.drone.yml', '.drone.star']), ver_mode),
        test_frontend(get_pr_trigger(exclude_paths=['pkg/**', 'packaging/**', 'go.sum', 'go.mod']), ver_mode),
        test_backend(get_pr_trigger(include_paths=['pkg/**', 'packaging/**', '.drone.yml', 'conf/**', 'go.sum', 'go.mod', 'public/app/plugins/**/plugin.json']), ver_mode),
        build_e2e(trigger, ver_mode, edition),
        integration_tests(trigger, ver_mode, edition),
        docs_pipelines(edition, ver_mode, trigger_docs())
    ]


def get_pr_trigger(include_paths=None, exclude_paths=None):
    paths_ex = ['docs/**', '*.md']
    paths_in = []
    if include_paths:
        for path in include_paths:
            paths_in.extend([path])
    if exclude_paths:
        for path in exclude_paths:
            paths_ex.extend([path])
    return {
        'event': [
            'pull_request',
        ],
        'paths': {
            'exclude': paths_ex,
            'include': paths_in,
        },
    }

