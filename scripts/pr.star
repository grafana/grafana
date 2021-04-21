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
    'build_docs_website_step',
    'copy_packages_for_docker_step',
    'build_docker_images_step',
    'postgres_integration_tests_step',
    'mysql_integration_tests_step',
    'redis_integration_tests_step',
    'memcached_integration_tests_step',
    'benchmark_ldap_step',
    'ldap_service',
    'integration_test_services',
)

ver_mode = 'pr'

def pr_pipelines(edition):
    services = integration_test_services(edition)
    variants = ['linux-x64', 'linux-x64-musl', 'osx64', 'win64',]
    include_enterprise2 = edition == 'enterprise'
    backendFilesChanged = {
        'paths': [ 'go.mod', 'go.sum', 'pkg/**', ]
    }
    docsFilesChanged = {
        'paths': [ 'docs/**', ]
    }
    shellFilesChanged = {
        'paths': [ '*.sh', ]
    }
    frontendFilesChanged = {
        'paths': [ 'package.json', 'yarn.lock', 'public/**', 'packages/**']
    }
    fullBuildFilesChanged = {
        'paths': backendFilesChanged['paths'] + frontendFilesChanged['paths'] + [
            'packaging/docker/**'
        ],
    }
    steps = [
        lint_backend_step(edition=edition, when=backendFilesChanged),
        codespell_step(when=docsFilesChanged),
        shellcheck_step(when=shellFilesChanged),
        test_backend_step(edition=edition, when=backendFilesChanged),
        test_frontend_step(when=frontendFilesChanged),
        build_backend_step(edition=edition, ver_mode=ver_mode, variants=variants, when=fullBuildFilesChanged),
        build_frontend_step(edition=edition, ver_mode=ver_mode, when=fullBuildFilesChanged),
        build_plugins_step(edition=edition, when=fullBuildFilesChanged),
    ]

    # Have to insert Enterprise2 steps before they're depended on (in the gen-version step)
    if include_enterprise2:
        edition2 = 'enterprise2'
        steps.append(benchmark_ldap_step())
        services.append(ldap_service())
        steps.extend([
            lint_backend_step(edition=edition2, when=backendFilesChanged),
            test_backend_step(edition=edition2, when=backendFilesChanged),
            build_backend_step(edition=edition2, ver_mode=ver_mode, variants=['linux-x64'], when=fullBuildFilesChanged),
        ])

    # Insert remaining steps
    steps.extend([
        gen_version_step(ver_mode=ver_mode, include_enterprise2=include_enterprise2, when=fullBuildFilesChanged),
        package_step(edition=edition, ver_mode=ver_mode, variants=variants, when=fullBuildFilesChanged),
        e2e_tests_server_step(edition=edition, when=fullBuildFilesChanged),
        e2e_tests_step(edition=edition, when=fullBuildFilesChanged),
        build_storybook_step(edition=edition, ver_mode=ver_mode, when=frontendFilesChanged),
        build_frontend_docs_step(edition=edition, when=frontendFilesChanged),
        build_docs_website_step(when=frontendFilesChanged),
        copy_packages_for_docker_step(when=fullBuildFilesChanged),
        build_docker_images_step(edition=edition, ver_mode=ver_mode, archs=['amd64',], when=fullBuildFilesChanged),
        postgres_integration_tests_step(when=backendFilesChanged),
        mysql_integration_tests_step(when=backendFilesChanged),
    ])

    if include_enterprise2:
        steps.extend([
            redis_integration_tests_step(when=fullBuildFilesChanged),
            memcached_integration_tests_step(when=fullBuildFilesChanged),
            package_step(edition=edition2, ver_mode=ver_mode, variants=['linux-x64'], when=fullBuildFilesChanged),
            e2e_tests_server_step(edition=edition2, port=3002, when=fullBuildFilesChanged),
            e2e_tests_step(edition=edition2, port=3002, when=fullBuildFilesChanged),
        ])

    trigger = {
        'event': ['pull_request',],
    }
    return [
        pipeline(
            name='test-pr', edition=edition, trigger=trigger, services=services, steps=steps,
            ver_mode=ver_mode,
        ),
    ]
