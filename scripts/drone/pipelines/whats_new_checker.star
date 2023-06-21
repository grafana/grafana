"""
This module contains logic for checking if the package.json whats new url matches with the in-flight tag.
"""

load(
    "scripts/drone/utils/images.star",
    "images",
)
load(
    "scripts/drone/steps/lib.star",
    "compile_build_cmd",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

def whats_new_checker_step():
    return {
        "name": "whats-new-checker",
        "image": images["go_image"],
        "depends_on": [
            "compile-build-cmd",
        ],
        "commands": [
            "./bin/build whatsnew-checker",
        ],
    }

def whats_new_checker_pipeline(trigger):
    environment = {"EDITION": "oss"}
    steps = [
        compile_build_cmd(),
        whats_new_checker_step(),
    ]
    return pipeline(
        name = "release-whatsnew-checker",
        edition = "oss",
        trigger = trigger,
        services = [],
        steps = steps,
        environment = environment,
    )
