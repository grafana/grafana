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

def verify_swagger_step():
    return {
        "name": "verify-swagger",
        "image": images["build_image"],
        "depends_on": [
            "compile-build-cmd",
        ],
        "commands": [
            "make swagger-api-spec",
            "git diff --exit-code || (echo \"Swagger API spec is out of date, please run 'make swagger-api-spec' and commit the changes\" && exit 1)",
        ],
    }

def verify_swagger(trigger, ver_mode):
    environment = {"EDITION": "oss"}
    steps = [
        identify_runner_step(),
        compile_build_cmd(),
        verify_swagger_step(),
    ]
    return pipeline(
        name = "{}-verify-swagger".format(ver_mode),
        edition = "oss",
        trigger = trigger,
        services = [],
        steps = steps,
        environment = environment,
    )
