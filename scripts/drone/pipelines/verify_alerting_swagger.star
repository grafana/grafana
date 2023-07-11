"""
This module returns a Drone step and pipeline for verifying the swagger spec is up to date.
"""

load(
    "scripts/drone/steps/lib.star",
    "compile_build_cmd",
    "identify_runner_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)
load(
    "scripts/drone/utils/images.star",
    "images",
)

def verify_alerting_swagger_step():
    return {
        "name": "verify-alerting-swagger",
        "image": images["build_image"],
        "depends_on": [
            "compile-build-cmd",
        ],
        "commands": [
            "make -C pkg/services/ngalert/api/tooling post.json",
            "git diff --exit-code || (printf \"\\nAlerting Swagger API spec is out of date, please run 'make -C pkg/services/ngalert/api/tooling post.json' and commit the changes\\n\" && exit 1)",
        ],
    }

def verify_alerting_swagger(trigger, ver_mode):
    environment = {"EDITION": "oss"}
    steps = [
        identify_runner_step(),
        compile_build_cmd(),
        verify_alerting_swagger_step(),
    ]
    return pipeline(
        name = "{}-verify-alerting-swagger".format(ver_mode),
        edition = "oss",
        trigger = trigger,
        services = [],
        steps = steps,
        environment = environment,
    )
