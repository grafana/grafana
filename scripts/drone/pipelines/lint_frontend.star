"""
This module returns the pipeline used for linting frontend code.
"""

load(
    "scripts/drone/steps/github.star",
    "github_app_generate_token_step",
    "github_app_pipeline_volumes",
)
load(
    "scripts/drone/steps/lib.star",
    "enterprise_setup_step",
    "identify_runner_step",
    "lint_frontend_step",
    "verify_i18n_step",
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

    init_steps = []
    lint_step = lint_frontend_step()
    i18n_step = verify_i18n_step()

    volumes = []

    if ver_mode == "pr":
        # In pull requests, attempt to clone grafana enterprise.
        init_steps = [
            github_app_generate_token_step(),
            enterprise_setup_step(),
        ]

        volumes += github_app_pipeline_volumes()

    init_steps += [
        identify_runner_step(),
        yarn_install_step(),
    ]
    test_steps = [
        lint_step,
        i18n_step,
    ]

    return pipeline(
        name = "{}-lint-frontend".format(ver_mode),
        trigger = trigger,
        services = [],
        steps = init_steps + test_steps,
        environment = environment,
        volumes = volumes,
    )
