"""
This module returns all the pipelines used in the event of pushes to an RRC branch.
"""

load(
    "scripts/drone/pipelines/integration_tests.star",
    "integration_tests",
)
load(
    "scripts/drone/pipelines/lint_backend.star",
    "lint_backend_pipeline",
)
load(
    "scripts/drone/pipelines/lint_frontend.star",
    "lint_frontend_pipeline",
)
load(
    "scripts/drone/pipelines/test_backend.star",
    "test_backend",
)
load(
    "scripts/drone/pipelines/test_frontend.star",
    "test_frontend",
)
load(
    "scripts/drone/steps/lib.star",
    "enterprise_downstream_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

ver_mode = "rrc"
trigger = {
    "ref": {
        "include": [
            "refs/tags/rrc*",
        ],
    },
    "branch": [
        "instant",
        "fast",
        "steady",
        "slow",
    ],
}

def rrc_patch_pipelines():
    pipelines = [
        test_frontend(trigger, ver_mode),
        lint_frontend_pipeline(trigger, ver_mode),
        test_backend(trigger, ver_mode),
        lint_backend_pipeline(trigger, ver_mode),
        integration_tests(trigger, prefix = ver_mode, ver_mode = ver_mode),
        rrc_enterprise_downstream_pipeline(trigger = trigger),
    ]

    return pipelines

def rrc_enterprise_downstream_pipeline(trigger):
    # Triggers a downstream pipeline in the grafana-enterprise repository for the rrc branch
    environment = {"EDITION": "oss"}
    steps = [
        enterprise_downstream_step(ver_mode = ver_mode),
    ]
    return pipeline(
        name = "rrc-trigger-downstream",
        trigger = trigger,
        steps = steps,
        depends_on = ["rrc-integration-tests"],
        environment = environment,
    )
