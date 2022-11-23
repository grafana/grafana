"""
This module returns the pipeline used for testing backend code.
"""

load(
    "scripts/drone/steps/lib.star",
    "clone_enterprise_step",
    "compile_build_cmd",
    "download_grabpl_step",
    "identify_runner_step",
    "init_enterprise_step",
    "test_backend_integration_step",
    "test_backend_step",
    "verify_gen_cue_step",
    "verify_gen_jsonnet_step",
    "wire_install_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

def test_backend(trigger, ver_mode, edition = "oss"):
    """Generates the pipeline used for testing backend code.

    Args:
      trigger: a Drone trigger for the pipeline.
      edition: controls whether the testing is performed with the addition of enterprise code.
        Defaults to 'oss'.
      ver_mode: indirectly controls which revision of enterprise code to use.

    Returns:
      Drone pipeline.
    """
    environment = {"EDITION": edition}
    init_steps = []
    if edition != "oss":
        init_steps.extend([clone_enterprise_step(ver_mode), download_grabpl_step(), init_enterprise_step(ver_mode)])
    init_steps.extend([
        identify_runner_step(),
        compile_build_cmd(edition),
        verify_gen_cue_step(edition),
        verify_gen_jsonnet_step(edition),
        wire_install_step(),
    ])
    test_steps = [
        test_backend_step(),
        test_backend_integration_step(),
    ]

    pipeline_name = "{}-test-backend".format(ver_mode)
    if ver_mode in ("release-branch", "release"):
        pipeline_name = "{}-{}-test-backend".format(ver_mode, edition)
    return pipeline(
        name = pipeline_name,
        edition = edition,
        trigger = trigger,
        services = [],
        steps = init_steps + test_steps,
        environment = environment,
    )
