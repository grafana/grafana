"""
This module returns all the pipelines used in the event of pushes to the main branch.
"""

load(
    "scripts/drone/pipelines/build.star",
    "build_e2e",
)
load(
    "scripts/drone/pipelines/docs.star",
    "docs_pipelines",
    "trigger_docs_main",
)
load(
    "scripts/drone/pipelines/trigger_downstream.star",
    "enterprise_downstream_pipeline",
)
load(
    "scripts/drone/utils/utils.star",
    "failure_template",
    "notify_pipeline",
)

ver_mode = "main"
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
    "repo": [
        "grafana/grafana",
    ],
}

def main_pipelines():
    # This is how we should define any new pipelines. At some point we should update existing ones.
    # Let's make an effort to reduce the amount of string constants in "depends_on" lists.
    pipelines = [
        docs_pipelines(ver_mode, trigger_docs_main()),
        build_e2e(trigger, ver_mode),
        enterprise_downstream_pipeline(),
        notify_pipeline(
            name = "main-notify",
            slack_channel = "grafana-ci-notifications",
            trigger = dict(trigger, status = ["failure"]),
            depends_on = [
                "main-build-e2e-publish",
            ],
            template = failure_template,
            secret = "slack_webhook",
        ),
    ]

    return pipelines
