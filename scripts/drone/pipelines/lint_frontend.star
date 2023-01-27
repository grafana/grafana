load(
    'scripts/drone/steps/lib.star',
    'identify_runner_step',
    'yarn_install_step',
    'lint_frontend_step',
    'enterprise_setup_step',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)


def lint_frontend_pipeline(trigger, ver_mode):
    environment = {'EDITION': 'oss'}

    init_steps = []
    lint_step = lint_frontend_step()

    if ver_mode == 'pr':
        # In pull requests, attempt to clone grafana enterprise.
        init_steps.append(enterprise_setup_step(location='../grafana-enterpise'))
        # Ensure the lint step happens after the clone-enterprise step

        lint_step['depends_on'] += ['clone-enterprise']

    init_steps += [
        identify_runner_step(),
        yarn_install_step(),
    ]
    test_steps = [
        lint_step,
    ]

    return pipeline(
        name='{}-lint-frontend'.format(ver_mode),
        edition="oss",
        trigger=trigger,
        services=[],
        steps=init_steps + test_steps,
        environment=environment,
    )
