"""
This module returns all the pipelines used in the event of pushes to the main branch.
"""

load(
    "scripts/drone/utils/utils.star",
    "drone_change_template",
    "failure_template",
    "notify_pipeline",
)
load(
    "scripts/drone/pipelines/docs.star",
    "docs_pipelines",
    "trigger_docs_main",
)
load(
    "scripts/drone/pipelines/test_frontend.star",
    "test_frontend",
)
load(
    "scripts/drone/pipelines/test_backend.star",
    "test_backend",
)
load(
    "scripts/drone/pipelines/integration_tests.star",
    "integration_tests",
)
load(
    "scripts/drone/pipelines/build.star",
    "build_e2e",
)
load(
    "scripts/drone/pipelines/windows.star",
    "windows",
    "windows_test_backend",
)
load(
    "scripts/drone/pipelines/trigger_downstream.star",
    "enterprise_downstream_pipeline",
)
load(
    "scripts/drone/pipelines/lint_backend.star",
    "lint_backend_pipeline",
)
load(
    "scripts/drone/pipelines/lint_frontend.star",
    "lint_frontend_pipeline",
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
}

def main_pipelines():
    drone_change_trigger = {
        "event": [
            "push",
        ],
        "branch": "main",
        "repo": [
            "grafana/grafana",
        ],
        "paths": {
            "include": [
                ".drone.yml",
            ],
            "exclude": [
                "exclude",
            ],
        },
    }

    pipelines = [
        docs_pipelines(ver_mode, trigger_docs_main()),
        test_frontend(trigger, ver_mode),
        lint_frontend_pipeline(trigger, ver_mode),
        test_backend(trigger, ver_mode),
        lint_backend_pipeline(trigger, ver_mode),
        build_e2e(trigger, ver_mode),
        integration_tests(trigger, prefix = ver_mode, ver_mode = ver_mode),
        windows(trigger, edition = "oss", ver_mode = ver_mode),
        windows_test_backend(trigger, "oss", ver_mode),
        windows_test_backend(trigger, "enterprise", ver_mode),
        notify_pipeline(
            name = "notify-drone-changes",
            slack_channel = "slack-webhooks-test",
            trigger = drone_change_trigger,
            template = drone_change_template,
            secret = "drone-changes-webhook",
        ),
        enterprise_downstream_pipeline(),
        notify_pipeline(
            name = "main-notify",
            slack_channel = "grafana-ci-notifications",
            trigger = dict(trigger, status = ["failure"]),
            depends_on = [
                "main-test-frontend",
                "main-test-backend",
                "main-build-e2e-publish",
                "main-integration-tests",
                "main-windows",
            ],
            template = failure_template,
            secret = "slack_webhook",
        ),
    ]

    return pipelines
