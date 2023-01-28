load('scripts/drone/steps/lib.star', 'build_image', 'compile_build_cmd')

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
    'external_name',
)

def trigger():
    return {
        'event': [
            'pull_request',
        ],
        'paths': {
            'exclude': [
                '*.md',
                'docs/**',
                'latest.json',
            ],
            'include': ['scripts/**/*.sh'],
        },
        'repo': {
            'include': ['grafana/*'],
        }
    }


def shellcheck_step():
    return {
        'name': 'shellcheck',
        'image': build_image,
        'depends_on': [
            'compile-build-cmd',
        ],
        'commands': [
            './bin/build shellcheck',
        ],
    }


def shellcheck_pipeline(external=False):
    environment = {'EDITION': 'oss'}
    steps = [
        compile_build_cmd(),
        shellcheck_step(),
    ]

    t = trigger()

    if external:
        t['repo'] = {
            'exclude': ['grafana/*'],
        }

    return pipeline(
        name=external_name('pr-shellcheck', external),
        edition="oss",
        trigger=t,
        services=[],
        steps=steps,
        environment=environment,
    )
