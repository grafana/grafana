load(
    'scripts/drone/steps/lib.star',
    'lint_backend_step',
    'lint_frontend_step',
    'codespell_step',
    'shellcheck_step',
    'build_backend_step',
    'build_frontend_step',
    'build_plugins_step',
    'test_backend_step',
    'test_backend_integration_step',
    'test_frontend_step',
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
    'ensure_cuetsified_step',
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

def docs_pipelines(edition):
    steps = [
        codespell_step(),
        shellcheck_step(),
        lint_frontend_step(),
        test_frontend_step(),
        build_frontend_step(edition=edition, ver_mode=ver_mode),
    ]

    # Insert remaining steps
    steps.extend([
        build_storybook_step(edition=edition, ver_mode=ver_mode),
        build_frontend_docs_step(edition=edition),
        build_docs_website_step(),
    ])

    trigger = {
        'paths': {
            'include': [
                'docs/**',
            ],
        },
    }
    return [
        pipeline(
            name='test-docs-pr', edition=edition, trigger=trigger, services=[], steps=steps,
            ver_mode=ver_mode,
        ),
    ]
