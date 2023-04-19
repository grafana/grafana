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
    "betterer_frontend_step",
    "clone_enterprise_step",
    "download_grabpl_step",
    "identify_runner_step",
    "init_enterprise_step",
    "test_frontend_step",
    "yarn_install_step",
)

def test_frontend(trigger, ver_mode):
    """Generates the pipeline used for testing frontend code.

    Args:
      trigger: a Drone trigger for the pipeline
      ver_mode: indirectly controls which revision of enterprise code to use.

    Returns:
      Drone pipeline.
    """
    environment = {"EDITION": "oss"}

    steps = [
        identify_runner_step(),
        download_grabpl_step(),
        yarn_install_step(),
        betterer_frontend_step(edition = "oss"),
        test_frontend_step(edition = "oss"),
    ]

    pipeline_name = "{}-test-frontend".format(ver_mode)
    if ver_mode in ("release-branch", "release"):
        pipeline_name = "{}-{}-test-frontend".format(ver_mode, "oss")

    return pipeline(
        name = pipeline_name,
        edition = "oss",
        trigger = trigger,
        steps = steps,
        environment = environment,
    )

def test_frontend_enterprise(trigger, ver_mode, committish, edition = "enterprise"):
    """Generates the pipeline used for testing frontend enterprise code.

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
            download_grabpl_step(),
            clone_enterprise_step(committish),
            init_enterprise_step(ver_mode),
            identify_runner_step(),
        ] +
        with_deps([yarn_install_step()], ["init-enterprise"]) +
        [
            betterer_frontend_step(edition),
            test_frontend_step(edition),
        ]
    )

    pipeline_name = "{}-test-frontend".format(ver_mode)
    if ver_mode in ("release-branch", "release"):
        pipeline_name = "{}-{}-test-frontend".format(ver_mode, edition)

    return pipeline(
        name = pipeline_name,
        edition = edition,
        trigger = trigger,
        steps = steps,
        environment = environment,
    )
