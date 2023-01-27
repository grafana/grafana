load(
    'scripts/drone/steps/lib.star',
    'clone_enterprise_step',
    'enterprise_setup_step',
    'identify_runner_step',
    'wire_install_step',
    'lint_backend_step',
    'lint_drone_step',
    'compile_build_cmd',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)


def lint_backend_pipeline(trigger, ver_mode):
    environment = {'EDITION': 'oss'}

    wire_step = wire_install_step()
    wire_step.update({'depends_on': []})

    init_steps = [
        identify_runner_step(),
        compile_build_cmd(),

    ]

    if ver_mode == 'pr':
        # In pull requests, attempt to clone grafana enterprise.
        init_steps += [
            clone_enterprise_step(source='${DRONE_SOURCE_BRANCH}', target='${DRONE_TARGET_BRANCH}', canFail=True, location='../grafana-enterprise'),
            enterprise_setup_step(location='../grafana-enterpise'),
        ]

    init_steps.append(wire_step)

    test_steps = [
        lint_backend_step(),
    ]

    if ver_mode == 'main':
        test_steps.append(lint_drone_step())

    return pipeline(
        name='{}-lint-backend'.format(ver_mode),
        edition="oss",
        trigger=trigger,
        services=[],
        steps=init_steps + test_steps,
        environment=environment,
    )
