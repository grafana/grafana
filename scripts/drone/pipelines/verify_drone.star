"""
This module returns the pipeline used for verifying Drone configuration.
"""

load(
    "scripts/drone/steps/lib.star",
    "compile_build_cmd",
    "identify_runner_step",
    "lint_drone_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

def verify_drone(trigger, ver_mode):
    environment = {"EDITION": "oss"}
    steps = [
        identify_runner_step(),
        compile_build_cmd(),
        lint_drone_step(),
    ]
    return pipeline(
        name = "{}-verify-drone".format(ver_mode),
        edition = "oss",
        trigger = trigger,
        services = [],
        steps = steps,
        environment = environment,
    )
