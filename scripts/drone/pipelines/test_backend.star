load(
    'scripts/drone/steps/lib.star',
    'identify_runner_step',
    'download_grabpl_step',
    'wire_install_step',
    'codespell_step',
    'shellcheck_step',
    'lint_backend_step',
    'lint_drone_step',
    'test_backend_step',
    'test_backend_integration_step',
    'verify_gen_cue_step',
    'compile_build_cmd',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)

def test_backend(trigger, ver_mode):
    init_steps = [
        identify_runner_step(),
        download_grabpl_step(),
        compile_build_cmd(),
        verify_gen_cue_step(edition="oss"),
        wire_install_step(),
    ]
    test_steps = [
        codespell_step(),
        shellcheck_step(),
        lint_backend_step(edition="oss"),
        test_backend_step(edition="oss"),
        test_backend_integration_step(edition="oss"),
    ]
    if ver_mode == 'main':
        test_steps.extend([lint_drone_step()])

    return pipeline(
        name='{}-test-backend'.format(ver_mode), edition="oss", trigger=trigger, services=[], steps=init_steps + test_steps,
    )
