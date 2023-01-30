"""
This module returns the pipeline used for linting frontend code.
"""

load(
    "scripts/drone/steps/lib.star",
    "identify_runner_step",
    "lint_frontend_step",
    "yarn_install_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

def lint_frontend_pipeline(trigger, ver_mode):
    """Generates the pipelines used linting frontend code.

    Args:
      trigger: controls which events can trigger the pipeline execution.
      ver_mode: used in the naming of the pipeline.

    Returns:
      Drone pipeline.
    """
    environment = {"EDITION": "oss"}

    init_steps = [
        identify_runner_step(),
        yarn_install_step(),
    ]

    test_steps = [
        lint_frontend_step(),
    ]

    return pipeline(
        name = "{}-lint-frontend".format(ver_mode),
        edition = "oss",
        trigger = trigger,
        services = [],
        steps = init_steps + test_steps,
        environment = environment,
    )
