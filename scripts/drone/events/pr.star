load(
    'scripts/drone/utils/utils.star',
    'pipeline',
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
    'trigger_docs_pr',
)

load(
    'scripts/drone/pipelines/shellcheck.star',
    'shellcheck_pipeline',
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
    return [
        verify_drone(get_pr_trigger(include_paths=['scripts/drone/**', '.drone.yml', '.drone.star']), ver_mode),
        test_frontend(get_pr_trigger(exclude_paths=['pkg/**', 'packaging/**', 'go.sum', 'go.mod']), ver_mode),
        test_backend(get_pr_trigger(include_paths=['pkg/**', 'packaging/**', '.drone.yml', 'conf/**', 'go.sum', 'go.mod', 'public/app/plugins/**/plugin.json', 'devenv/**']), ver_mode),
        build_e2e(trigger, ver_mode, edition),
        integration_tests(get_pr_trigger(include_paths=['pkg/**', 'packaging/**', '.drone.yml', 'conf/**', 'go.sum', 'go.mod', 'public/app/plugins/**/plugin.json']), ver_mode, edition),
        docs_pipelines(edition, ver_mode, trigger_docs_pr()),
        shellcheck_pipeline(),
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

