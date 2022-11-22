"""
This module returns the pipeline used for testing backend code.
"""

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
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

def test_frontend(trigger, ver_mode, edition = "oss"):
    """Generates the pipeline used for testing frontend code.

    Args:
      trigger: TODO
      edition: TODO
        Defaults to 'oss'.
      ver_mode: TODO

    Returns:
      Drone pipeline.
    """
    environment = {"EDITION": edition}
    init_steps = []
    if edition != "oss":
        init_steps.extend([clone_enterprise_step(ver_mode), init_enterprise_step(ver_mode)])
    init_steps.extend([
        identify_runner_step(),
        download_grabpl_step(),
        yarn_install_step(edition),
    ])
    test_steps = [
        betterer_frontend_step(edition),
        test_frontend_step(edition),
    ]
    pipeline_name = "{}-test-frontend".format(ver_mode)
    if ver_mode in ("release-branch", "release"):
        pipeline_name = "{}-{}-test-frontend".format(ver_mode, edition)
    return pipeline(
        name = pipeline_name,
        edition = edition,
        trigger = trigger,
        services = [],
        steps = init_steps + test_steps,
        environment = environment,
    )
