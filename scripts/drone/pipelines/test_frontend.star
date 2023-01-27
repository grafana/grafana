load(
    'scripts/drone/steps/lib.star',
    'identify_runner_step',
    'clone_enterprise_step',
    'init_enterprise_step',
    'download_grabpl_step',
    'yarn_install_step',
    'betterer_frontend_step',
    'test_frontend_step',
    'enterprise_setup_step',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
    'with_deps',
)


def test_frontend(trigger, ver_mode, source):
    environment = {'EDITION': 'oss'}

    steps = [
        identify_runner_step(),
        download_grabpl_step(),
        yarn_install_step(),
        betterer_frontend_step(edition='oss'),
    ]

    test_step = test_frontend_step(edition='oss')

    if ver_mode == 'pr':
        # In pull requests, attempt to clone grafana enterprise.
        steps.append(enterprise_setup_step(location='../grafana-enterpise'))
        # Also, make the test step depend on 'clone-enterprise
        test_step['depends_on'] += ['clone-enterprise']

    steps.append(test_step)

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


def test_frontend_enterprise(trigger, ver_mode, source, edition='enterprise'):
    environment = {'EDITION': edition}

    steps = (
        [
            clone_enterprise_step(source),
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
