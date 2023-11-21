"""
This module returns a Drone step and pipeline for linting with shellcheck.
"""

load("scripts/drone/steps/lib.star", "compile_build_cmd")
load(
    "scripts/drone/utils/images.star",
    "images",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

trigger = {
    "event": [
        "pull_request",
    ],
    "paths": {
        "exclude": [
            "*.md",
            "docs/**",
            "latest.json",
        ],
        "include": ["scripts/**/*.sh"],
    },
}

def shellcheck_step():
    return {
        "name": "shellcheck",
        "image": images["ubuntu"],
        "commands": [
            "apt-get update -yq && apt-get install shellcheck",
            "shellcheck -e SC1071 -e SC2162 scripts/**/*.sh",
        ],
    }

def shellcheck_pipeline():
    environment = {"EDITION": "oss"}
    steps = [
        compile_build_cmd(),
        shellcheck_step(),
    ]
    return pipeline(
        name = "pr-shellcheck",
        trigger = trigger,
        services = [],
        steps = steps,
        environment = environment,
    )
