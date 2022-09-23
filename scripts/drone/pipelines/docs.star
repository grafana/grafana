load(
    'scripts/drone/steps/lib.star',
    'build_image',
    'yarn_install_step',
    'identify_runner_step',
    'download_grabpl_step',
    'lint_frontend_step',
    'codespell_step',
    'test_frontend_step',
    'build_storybook_step',
    'build_frontend_package_step',
    'build_docs_website_step',
    'compile_build_cmd',
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

docs_paths = {
    'include': [
        '*.md',
        'docs/**',
        'packages/**/*.md',
        'latest.json',
    ],
}

def docs_pipelines(edition, ver_mode, trigger):
    steps = [
        download_grabpl_step(),
        identify_runner_step(),
        yarn_install_step(),
        codespell_step(),
        lint_docs(),
        build_frontend_package_step(edition=edition, ver_mode=ver_mode),
        build_docs_website_step(),
        compile_build_cmd(),
    ]

    return pipeline(
        name='{}-docs'.format(ver_mode), edition=edition, trigger=trigger, services=[], steps=steps,
    )

def lint_docs():
    return {
        'name': 'lint-docs',
        'image': build_image,
        'depends_on': [
            'yarn-install',
        ],
        'environment': {
            'NODE_OPTIONS': '--max_old_space_size=8192',
        },
        'commands': [
            'yarn run prettier:checkDocs',
        ],
    }


def trigger_docs_main():
    return {
        'branch': 'main',
        'event': [
            'push',
        ],
        'paths': docs_paths,
    }

def trigger_docs_pr():
    return {
        'event': [
            'pull_request',
        ],
        'paths': docs_paths,
    }
