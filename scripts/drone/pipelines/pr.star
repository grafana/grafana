load(
    'scripts/drone/steps/lib.star',
    'restore_cache_step',
    'lint_backend_step',
    'codespell_step',
    'shellcheck_step',
    'build_backend_step',
    'build_frontend_step',
    'rebuild_cache_step',
    'build_plugins_step',
    'test_backend_step',
    'test_frontend_step',
    'gen_version_step',
    'package_step',
    'e2e_tests_server_step',
    'e2e_tests_step',
    'build_storybook_step',
    'build_frontend_docs_step',
    'build_docs_website_step',
    'copy_packages_for_docker_step',
    'build_docker_images_step',
    'postgres_integration_tests_step',
    'mysql_integration_tests_step',
    'redis_integration_tests_step',
    'memcached_integration_tests_step',
    'benchmark_ldap_step',
    'validate_scuemata_step',
    'test_a11y_frontend_step_pr',
)

load(
    'scripts/drone/services/services.star',
    'integration_test_services',
    'ldap_service',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)

ver_mode = 'pr'

def pr_pipelines(edition):
    variants = ['linux-x64', 'linux-x64-musl', 'osx64', 'win64', 'armv6',]
    include_enterprise2 = edition == 'enterprise'
    steps = [
        codespell_step(),
        shellcheck_step(),
        restore_cache_step(),
        lint_backend_step(edition=edition),
        test_frontend_step(),
        build_frontend_step(edition=edition, ver_mode=ver_mode),
        rebuild_cache_step(),
    ]

    trigger = {
        'event': ['pull_request',],
    }
    return [
        pipeline(
            name='test-pr', edition=edition, trigger=trigger, services=None, steps=steps,
            ver_mode=ver_mode,
        ),
    ]
