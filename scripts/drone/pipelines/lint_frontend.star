load(
    'scripts/drone/steps/lib.star',
    'identify_runner_step',
    'yarn_install_step',
    'lint_frontend_step',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)


def lint_frontend_pipeline(trigger, ver_mode):
    environment = {'EDITION': 'oss', 'NX_BRANCH': '${DRONE_BRANCH}'}

    init_steps = [
        identify_runner_step(),
        yarn_install_step(),
    ]

    test_steps = [
        lint_frontend_step(),
    ]

    return pipeline(
        name='{}-lint-frontend'.format(ver_mode),
        edition="oss",
        trigger=trigger,
        services=[],
        steps=init_steps + test_steps,
        environment=environment,
    )
