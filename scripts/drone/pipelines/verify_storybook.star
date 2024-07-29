"""
This module returns the pipeline used for verifying the storybook build.
"""

load(
    "scripts/drone/steps/lib.star",
    "e2e_storybook_step",
    "identify_runner_step",
    "start_storybook_step",
    "yarn_install_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

def verify_storybook(trigger, ver_mode):
    """Generates the pipeline used for verifying the storybook build.

    Args:
      trigger: a Drone trigger for the pipeline
      ver_mode: indirectly controls which revision of enterprise code to use.

    Returns:
      Drone pipeline.
    """
    environment = {"EDITION": "oss"}

    steps = [
        identify_runner_step(),
        yarn_install_step(),
        start_storybook_step(),
        e2e_storybook_step(),
    ]

    return pipeline(
        name = "{}-verify-storybook".format(ver_mode),
        trigger = trigger,
        steps = steps,
        environment = environment,
    )
