load(
    'scripts/drone/steps/lib.star',
    'identify_runner_step',
    'download_grabpl_step',
    'yarn_install_step',
    'lint_frontend_step',
    'betterer_frontend_step',
    'test_frontend_step',
    'compile_build_cmd',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)

def test_frontend(trigger, ver_mode):
    init_steps = [
        identify_runner_step(),
        download_grabpl_step(),
        yarn_install_step(),
        compile_build_cmd(),
    ]
    test_steps = [
        lint_frontend_step(),
        betterer_frontend_step(),
        test_frontend_step(),
    ]
    return pipeline(
        name='{}-test-frontend'.format(ver_mode), edition="oss", trigger=trigger, services=[], steps=init_steps + test_steps,
    )
