"""
This module returns the pipeline used for testing backend code.
"""

load(
    "scripts/drone/steps/github.star",
    "github_app_generate_token_step",
    "github_app_pipeline_volumes",
)
load(
    "scripts/drone/steps/lib.star",
    "betterer_frontend_step",
    "enterprise_setup_step",
    "identify_runner_step",
    "test_frontend_step",
    "yarn_install_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
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
        yarn_install_step(),
        betterer_frontend_step(),
    ]

    test_step = test_frontend_step()

    volumes = []

    if ver_mode == "pr":
        # In pull requests, attempt to clone grafana enterprise.
        steps.append(github_app_generate_token_step())
        steps.append(enterprise_setup_step())

        volumes += github_app_pipeline_volumes()

    steps.append(test_step)

    return pipeline(
        name = "{}-test-frontend".format(ver_mode),
        trigger = trigger,
        steps = steps,
        environment = environment,
        volumes = volumes,
    )
