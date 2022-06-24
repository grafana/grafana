load(
    'scripts/drone/scribe/docs.star',
    'build_documentation_website_pipeline',
)

load(
    'scripts/drone/steps/lib.star',
    'identify_runner_step',
)

def docs_pipelines(edition, ver_mode, trigger):
    pipeline = build_documentation_website_pipeline()
    steps = [
        identify_runner_step(),
    ]


    pipeline["name"] = '{}-docs'.format(ver_mode)
    pipeline["steps"] = steps + pipeline["steps"]
    pipeline["trigger"] = trigger_docs(ver_mode)
    pipeline["node"] = {
        "type": "no-parallel",
    }

    return pipeline

def trigger_docs(ver_mode):
    if ver_mode == 'main':
        return {
            'event': ['push',],
            'branch': 'main',
        }

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
