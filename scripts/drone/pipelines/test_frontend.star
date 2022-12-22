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
    'with_deps',
)


def test_frontend(trigger, ver_mode, committish):
    environment = {'EDITION': 'oss'}

    steps = [
        identify_runner_step(),
        download_grabpl_step(),
        yarn_install_step(),
        betterer_frontend_step(edition='oss'),
        test_frontend_step(edition='oss'),
    ]

    pipeline_name = '{}-test-frontend'.format(ver_mode)
    if ver_mode in ("release-branch", "release"):
        pipeline_name = '{}-{}-test-frontend'.format(ver_mode, 'oss')

    return pipeline(
        name=pipeline_name,
        edition='oss',
        trigger=trigger,
        steps=steps,
        environment=environment,
    )


def test_frontend_enterprise(trigger, ver_mode, committish, edition='enterprise'):
    environment = {'EDITION': edition}

    steps = (
        [
            clone_enterprise_step(committish),
            init_enterprise_step(ver_mode),
            identify_runner_step(),
            download_grabpl_step(),
        ]
        + with_deps([yarn_install_step()], ['init-enterprise'])
        + [
            betterer_frontend_step(edition),
            test_frontend_step(edition),
        ]
    )

    pipeline_name = '{}-test-frontend'.format(ver_mode)
    if ver_mode in ("release-branch", "release"):
        pipeline_name = '{}-{}-test-frontend'.format(ver_mode, edition)

    return pipeline(
        name=pipeline_name,
        edition=edition,
        trigger=trigger,
        steps=steps,
        environment=environment,
    )
