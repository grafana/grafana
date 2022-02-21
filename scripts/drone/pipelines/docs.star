load(
    'scripts/drone/steps/lib.star',
    'initialize_step',
    'lint_frontend_step',
    'codespell_step',
    'shellcheck_step',
    'build_frontend_step',
    'test_frontend_step',
    'build_storybook_step',
    'build_frontend_docs_step',
    'build_docs_website_step',
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
    steps = initialize_step(edition, platform='linux', ver_mode=ver_mode)
    steps.extend([
        lint_frontend_step(),
        test_frontend_step(),
        build_frontend_step(edition=edition, ver_mode=ver_mode),
    ])

    # Insert remaining steps
    steps.extend([
        build_storybook_step(edition=edition, ver_mode=ver_mode),
        build_frontend_docs_step(edition=edition),
        build_docs_website_step(),
    ])

    trigger = {
        'event': {
            'include': [
                'pull_request',
            ]
        },
        'paths': {
            'include': [
                'docs/**',
            ],
        },
    }
    return [
        pipeline(
            name='test-docs-pr', edition=edition, trigger=trigger, services=[], steps=steps,
        ),
    ]
