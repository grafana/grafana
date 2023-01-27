load(
    'scripts/drone/steps/lib.star',
    'identify_runner_step',
    'download_grabpl_step',
    'lint_drone_step',
    'compile_build_cmd',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
    'external_name',
)


def verify_drone(trigger, ver_mode, external=False):
    environment = {'EDITION': 'oss'}
    steps = [
        identify_runner_step(),
        download_grabpl_step(),
        compile_build_cmd(),
        lint_drone_step(),
    ]
    return pipeline(
        name=external_name('{}-verify-drone'.format(ver_mode), external),
        edition="oss",
        trigger=trigger,
        services=[],
        steps=steps,
        environment=environment,
    )
