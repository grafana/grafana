load(
    'scripts/drone/steps/lib.star',
    'enterprise_downstream_step',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)

trigger = {
    'event': ['push',],
    'branch': 'main',
    'paths': {
        'exclude': [
            '*.md',
            'docs/**',
            'latest.json',
        ],
    },
}

def enterprise_downstream_pipeline(edition, ver_mode):
    steps = [enterprise_downstream_step(edition, ver_mode)]
    deps = ['main-build-e2e-publish', 'main-integration-tests']
    return pipeline(
                name='main-trigger-downstream', edition=edition, trigger=trigger, services=[], steps=steps, depends_on=deps
        )
