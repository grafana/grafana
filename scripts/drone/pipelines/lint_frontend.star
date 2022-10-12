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
    yarn_step = yarn_install_step()
    yarn_step.update({ 'depends_on': [] })
    init_steps = [
        identify_runner_step(),
        yarn_step,
    ]
    test_steps = [
        lint_frontend_step(),
    ]
    return pipeline(
        name='{}-lint-frontend'.format(ver_mode), edition="oss", trigger=trigger, services=[], steps=init_steps + test_steps,
    )
