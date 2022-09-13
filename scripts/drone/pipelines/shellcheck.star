load(
    'scripts/drone/steps/lib.star',
    'compile_build_cmd'
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)

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
        'include': [
            'scripts/**.sh'
        ],
    },
}

def shellcheck_step():
    return {
        'name': 'shellcheck',
        'image': 'koalaman/shellcheck:v0.8.0',
        'depends_on': [
            'compile-build-cmd',
        ],
        'commands': [
            './bin/build shellcheck',
        ],
    }

def shellcheck_pipeline():
    steps = [
        compile_build_cmd(),
        shellcheck_step(),
    ]
    return pipeline(
            name='shellcheck', edition="oss", trigger=trigger, services=[], steps=steps,
    )

