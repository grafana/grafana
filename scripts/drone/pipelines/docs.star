load(
    'scripts/drone/scribe/docs.star',
    'build_documentation_pipeline',
)

load(
    'scripts/drone/steps/lib.star',
    'identify_runner_step',
)

def docs_pipelines(edition, ver_mode, trigger):
    pipeline = build_documentation_pipeline()
    steps = [
        identify_runner_step(),
    ]

    pipeline["steps"] = steps + pipeline["steps"]
    pipeline["trigger"] = trigger_docs()
    return pipeline

def trigger_docs():
    return {
        'event': [
            'pull_request',
        ],
        'paths': {
            'include': [
                '*.md',
                'docs/**',
                'packages/**',
                'latest.json',
            ],
        },
    }
