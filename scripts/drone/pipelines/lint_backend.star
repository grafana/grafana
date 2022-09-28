load(
    'scripts/drone/steps/lib.star',
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
    wire_step = wire_install_step()
    wire_step.update({ 'depends_on': [] })
    init_steps = [
        identify_runner_step(),
        compile_build_cmd(),
        wire_step,
    ]
    test_steps = [
        lint_backend_step(edition="oss"),
    ]
    if ver_mode == 'main':
        test_steps.extend([lint_drone_step()])

    return pipeline(
        name='{}-lint-backend'.format(ver_mode), edition="oss", trigger=trigger, services=[], steps=init_steps + test_steps,
    )
