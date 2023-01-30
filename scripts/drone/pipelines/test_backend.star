"""
This module returns the pipeline used for testing backend code.
"""

load(
    "scripts/drone/utils/utils.star",
    "pipeline",
    "with_deps",
)
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

def test_backend(trigger, ver_mode):
    """Generates the pipeline used for testing OSS backend code.

    Args:
      trigger: a Drone trigger for the pipeline.
      ver_mode: affects the pipeline name.

    Returns:
      Drone pipeline.
    """
    environment = {"EDITION": "oss"}

    steps = [
        identify_runner_step(),
        compile_build_cmd(edition = "oss"),
        verify_gen_cue_step(),
        verify_gen_jsonnet_step(),
        wire_install_step(),
        test_backend_step(),
        test_backend_integration_step(),
    ]

    pipeline_name = "{}-test-backend".format(ver_mode)
    if ver_mode in ("release-branch", "release"):
        pipeline_name = "{}-{}-test-backend".format(ver_mode, "oss")

    return pipeline(
        name = pipeline_name,
        edition = "oss",
        trigger = trigger,
        steps = steps,
        environment = environment,
    )

def test_backend_enterprise(trigger, ver_mode, committish, edition = "enterprise"):
    """Generates the pipeline used for testing backend enterprise code.

    Args:
      trigger: a Drone trigger for the pipeline.
      ver_mode: affects the pipeline name.
      committish: controls what revision of enterprise code to test with.
      edition: affects the clone step in the pipeline and also affects the pipeline name.

    Returns:
      Drone pipeline.
    """
    environment = {"EDITION": edition}

    steps = (
        [
            clone_enterprise_step(committish),
            download_grabpl_step(),
            init_enterprise_step(ver_mode),
            identify_runner_step(),
            compile_build_cmd(edition),
        ] +
        with_deps(
            [
                verify_gen_cue_step(),
                verify_gen_jsonnet_step(),
            ],
            [
                "init-enterprise",
            ],
        ) +
        [
            wire_install_step(),
            test_backend_step(),
            test_backend_integration_step(),
        ]
    )

    pipeline_name = "{}-test-backend".format(ver_mode)
    if ver_mode in ("release-branch", "release"):
        pipeline_name = "{}-{}-test-backend".format(ver_mode, edition)

    return pipeline(
        name = pipeline_name,
        edition = edition,
        trigger = trigger,
        steps = steps,
        environment = environment,
    )
