load(
    'scripts/drone/steps/lib.star',
    'get_windows_steps',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)


def windows(trigger, edition, ver_mode):
    environment = {'EDITION': edition}

    return pipeline(
        name='main-windows',
        edition=edition,
        trigger=dict(trigger, repo=['grafana/grafana']),
        steps=get_windows_steps(edition, ver_mode),
        depends_on=[
            'main-test-frontend',
            'main-test-backend',
            'main-build-e2e-publish',
            'main-integration-tests',
        ],
        platform='windows',
        environment=environment,
    )
