load(
    'scripts/drone/steps/lib.star',
    'identify_runner_step',
    'clone_enterprise_step',
    'init_enterprise_step',
    'download_grabpl_step',
    'yarn_install_step',
    'betterer_frontend_step',
    'test_frontend_step',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)

def test_frontend(trigger, ver_mode, edition="oss"):
    environment = {'EDITION': edition}
    init_steps = []
    if edition != 'oss':
        init_steps.extend([clone_enterprise_step(ver_mode), init_enterprise_step(ver_mode),])
    init_steps.extend([
        identify_runner_step(),
        download_grabpl_step(),
        yarn_install_step(edition),
    ])
    test_steps = [
        betterer_frontend_step(edition),
        test_frontend_step(edition),
    ]
    pipeline_name = '{}-test-frontend'.format(ver_mode)
    if ver_mode in ("release-branch", "release"):
        pipeline_name = '{}-{}-test-frontend'.format(ver_mode, edition)
    return pipeline(
        name=pipeline_name, edition=edition, trigger=trigger, services=[], steps=init_steps + test_steps,
    )
