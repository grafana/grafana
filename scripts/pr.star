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
    'build_docs_website_step',
    'copy_packages_for_docker_step',
    'build_docker_images_step',
    'postgres_integration_tests_step',
    'mysql_integration_tests_step',
    'benchmark_ldap_step',
    'ldap_service',
    'integration_test_services',
)

ver_mode = 'pr'

def pr_pipelines(edition):
    services = integration_test_services()
    variants = ['linux-x64', 'linux-x64-musl', 'osx64', 'win64',]
    steps = [
        lint_backend_step(edition),
        codespell_step(),
        shellcheck_step(),
        test_backend_step(),
        test_frontend_step(),
        build_backend_step(edition=edition, ver_mode=ver_mode, variants=variants),
        build_frontend_step(edition=edition, ver_mode=ver_mode),
        build_plugins_step(edition=edition),
        package_step(edition=edition, ver_mode=ver_mode, variants=variants),
        e2e_tests_server_step(),
        e2e_tests_step(),
        build_storybook_step(edition=edition, ver_mode=ver_mode),
        build_frontend_docs_step(edition=edition),
        build_docs_website_step(),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition=edition, ver_mode=ver_mode, archs=['amd64',]),
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
    ]
    if edition == 'enterprise':
        steps.append(benchmark_ldap_step())
        services.append(ldap_service())
    trigger = {
        'event': ['pull_request',],
    }
    return [
        pipeline(
            name='test-pr', edition=edition, trigger=trigger, services=services, steps=steps,
            ver_mode=ver_mode,
        ),
    ]
