load(
    'scripts/drone/steps/lib.star',
    'initialize_step',
    'download_grabpl_step',
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
    steps = [download_grabpl_step()] + initialize_step(edition, platform='linux', ver_mode=ver_mode)

    # Insert remaining steps
    steps.extend([
        build_frontend_docs_step(edition=edition),
        build_docs_website_step(),
    ])

    trigger = {
        'event':  [
            'pull_request',
        ],
        'paths': {
            'include': [
                'docs/**',
                'packages/**',
            ],
        },
    }
    return [
        pipeline(
            name='pr-docs', edition=edition, trigger=trigger, services=[], steps=steps,
        ),
    ]
