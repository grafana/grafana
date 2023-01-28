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
    'external_name',
)


def lint_backend_pipeline(trigger, ver_mode, external=False):
    environment = {'EDITION': 'oss'}

    wire_step = wire_install_step()
    wire_step.update({'depends_on': []})

    init_steps = [
        identify_runner_step(),
        compile_build_cmd(),

    ]

    if ver_mode == 'pr' and external:
        # In pull requests, attempt to clone grafana enterprise.
        init_steps.append(enterprise_setup_step(location='../grafana-enterpise'))

    init_steps.append(wire_step)

    test_steps = [
        lint_backend_step(),
    ]

    if ver_mode == 'main':
        test_steps.append(lint_drone_step())

    return pipeline(
        name=external_name('{}-lint-backend'.format(ver_mode), external),
        edition="oss",
        trigger=trigger,
        services=[],
        steps=init_steps + test_steps,
        environment=environment,
    )
