"""
This module returns the pipeline used for linting backend code.
"""

load(
    "scripts/drone/steps/lib.star",
    "compile_build_cmd",
    "enterprise_setup_step",
    "identify_runner_step",
    "lint_backend_step",
    "lint_drone_step",
    "wire_install_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

def lint_backend_pipeline(trigger, ver_mode):
    """Generates the pipelines used linting backend code.

    Args:
      trigger: controls which events can trigger the pipeline execution.
      ver_mode: used in the naming of the pipeline.

    Returns:
      Drone pipeline.
    """
    environment = {"EDITION": "oss"}

    wire_step = wire_install_step()
    wire_step.update({"depends_on": []})

    init_steps = [
        identify_runner_step(),
        compile_build_cmd(),
    ]

    if ver_mode == "pr":
        # In pull requests, attempt to clone grafana enterprise.
        init_steps.append(enterprise_setup_step())
        wire_step["depends_on"].append("clone-enterprise")

    init_steps.append(wire_step)

    test_steps = [
        lint_backend_step(),
    ]

    if ver_mode == "main":
        test_steps.append(lint_drone_step())

    return pipeline(
        name = "{}-lint-backend".format(ver_mode),
        edition = "oss",
        trigger = trigger,
        services = [],
        steps = init_steps + test_steps,
        environment = environment,
    )
