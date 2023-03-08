"""
This module returns the pipeline used for triggering a downstream pipeline for Grafana Enterprise.
"""

load(
    "scripts/drone/steps/lib.star",
    "enterprise_downstream_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

trigger = {
    "event": [
        "push",
    ],
    "branch": "main",
    "paths": {
        "exclude": [
            "*.md",
            "docs/**",
            "latest.json",
        ],
    },
}

def enterprise_downstream_pipeline():
    environment = {"EDITION": "oss"}
    steps = [
        enterprise_downstream_step(ver_mode = "main"),
    ]
    deps = [
        "main-build-e2e-publish",
        "main-integration-tests",
    ]
    return pipeline(
        name = "main-trigger-downstream",
        edition = "oss",
        trigger = trigger,
        services = [],
        steps = steps,
        depends_on = deps,
        environment = environment,
    )
