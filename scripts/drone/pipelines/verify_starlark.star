"""
This module returns a Drone pipeline that verifies all Starlark files are linted.
"""

load(
    "scripts/drone/steps/lib.star",
    "compile_build_cmd",
    "identify_runner_step",
    "lint_starlark_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

def verify_starlark(trigger, ver_mode):
    environment = {"EDITION": "oss"}
    steps = [
        identify_runner_step(),
        compile_build_cmd(),
        lint_starlark_step(),
    ]
    return pipeline(
        name = "{}-verify-starlark".format(ver_mode),
        edition = "oss",
        trigger = trigger,
        services = [],
        steps = steps,
        environment = environment,
    )
