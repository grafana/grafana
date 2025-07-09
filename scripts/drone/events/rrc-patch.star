"""
This module returns all the pipelines used in the event of pushes to an RRC branch.
"""

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
        environment = environment,
    )
