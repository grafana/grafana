load(
    'scripts/drone/steps/lib.star',
    'identify_runner_step',
    'download_grabpl_step',
    'wire_install_step',
    'test_backend_step',
    'test_backend_integration_step',
    'verify_gen_cue_step',
    'verify_gen_jsonnet_step',
    'compile_build_cmd',
    'clone_enterprise_step',
    'init_enterprise_step',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
    'set_deps',
)


def test_backend(trigger, ver_mode, committish, edition="oss"):
    environment = {'EDITION': edition}
    init_steps = []
    if edition != 'oss':
        init_steps.extend(
            [
                clone_enterprise_step(committish),
                download_grabpl_step(),
                init_enterprise_step(ver_mode),
            ]
        )
    init_steps.extend(
        [
            identify_runner_step(),
            compile_build_cmd(edition),
        ]
    )
    if edition != 'oss':
        init_steps.extend(
            set_deps(
                [
                    verify_gen_cue_step(),
                    verify_gen_jsonnet_step(),
                ],
                [
                    'init-enterprise',
                ],
            )
        )
    else:
        init_steps.extend(
            [
                verify_gen_cue_step(),
                verify_gen_jsonnet_step(),
            ]
        )
    init_steps.extend(
        [
            wire_install_step(),
        ]
    )
    test_steps = [
        test_backend_step(),
        test_backend_integration_step(),
    ]

    pipeline_name = '{}-test-backend'.format(ver_mode)
    if ver_mode in ("release-branch", "release"):
        pipeline_name = '{}-{}-test-backend'.format(ver_mode, edition)
    return pipeline(
        name=pipeline_name,
        edition=edition,
        trigger=trigger,
        services=[],
        steps=init_steps + test_steps,
        environment=environment,
    )
