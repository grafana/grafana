load(
    'scripts/drone/steps/lib.star',
    'identify_runner_step',
    'wire_install_step',
    'verify_gen_cue_step',
    'compile_build_cmd',
    'clone_enterprise_step',
    'init_enterprise_step',
    'enterprise2_suffix',
    'build_image',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)

def test_backend_step(edition):
    if edition == 'enterprise2':
        return {
            'name': 'test-backend' + enterprise2_suffix(edition),
            'image': build_image,
            'depends_on': [
                'wire-install',
            ],
            'commands': [
                'go test -tags=pro -covermode=atomic -timeout=5m ./pkg/...',
            ],
        }
    else:
        return {
            'name': 'test-backend' + enterprise2_suffix(edition),
            'image': build_image,
            'depends_on': [
                'wire-install',
            ],
            'commands': [
                'go test -short -covermode=atomic -timeout=5m ./pkg/...',
            ],
        }


def test_backend_integration_step(edition):
    return {
        'name': 'test-backend-integration',
        'image': build_image,
        'depends_on': [
            'wire-install',
        ],
        'commands': [
            'go test -run Integration -covermode=atomic -timeout=5m ./pkg/...',
        ],
    }

def test_backend(trigger, ver_mode, edition="oss"):
    environment = {'EDITION': edition}
    init_steps = []
    if edition != 'oss':
        init_steps.extend([clone_enterprise_step(ver_mode), init_enterprise_step(ver_mode),])
    init_steps.extend([
        identify_runner_step(),
        compile_build_cmd(edition),
        verify_gen_cue_step(edition),
        wire_install_step(),
    ])
    test_steps = [
        test_backend_step(edition),
        test_backend_integration_step(edition),
    ]

    pipeline_name = '{}-test-backend'.format(ver_mode)
    if ver_mode in ("release-branch", "release"):
        pipeline_name = '{}-{}-test-backend'.format(ver_mode, edition)
    return pipeline(
        name=pipeline_name, edition=edition, trigger=trigger, services=[], steps=init_steps + test_steps, environment=environment
    )
