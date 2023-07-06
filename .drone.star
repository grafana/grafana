# To generate the .drone.yml file:
# 1. Modify the *.star definitions
# 2. Login to drone and export the env variables (token and server) shown here: https://drone.grafana.net/account
# 3. Run `make drone`
# More information about this process here: https://github.com/grafana/deployment_tools/blob/master/docs/infrastructure/drone/signing.md
"""
This module returns a Drone configuration including pipelines and secrets.
"""

load("scripts/drone/events/pr.star", "pr_pipelines")
load("scripts/drone/events/main.star", "main_pipelines")
load(
    "scripts/drone/events/release.star",
    "enterprise2_pipelines",
    "enterprise_pipelines",
    "integration_test_pipelines",
    "oss_pipelines",
    "publish_artifacts_pipelines",
    "publish_npm_pipelines",
    "publish_packages_pipeline",
    "verify_release_pipeline",
)
load(
    "scripts/drone/rgm.star",
    "rgm",
)
load(
    "scripts/drone/pipelines/publish_images.star",
    "publish_image_pipelines_public",
)
load(
    "scripts/drone/pipelines/ci_images.star",
    "publish_ci_windows_test_image_pipeline",
)
load("scripts/drone/pipelines/github.star", "publish_github_pipeline")
load("scripts/drone/pipelines/aws_marketplace.star", "publish_aws_marketplace_pipeline")
load(
    "scripts/drone/pipelines/windows.star",
    "windows_test_backend",
)
load("scripts/drone/version.star", "version_branch_pipelines")
load("scripts/drone/events/cron.star", "cronjobs")
load("scripts/drone/vault.star", "secrets")

def main(_ctx):
    return (
        pr_pipelines() +
        main_pipelines() +
        oss_pipelines() +
        enterprise_pipelines() +
        enterprise2_pipelines() +
        publish_image_pipelines_public() +
        publish_github_pipeline("public") +
        publish_github_pipeline("security") +
        publish_aws_marketplace_pipeline("public") +
        publish_artifacts_pipelines("security") +
        publish_artifacts_pipelines("public") +
        publish_npm_pipelines() +
        publish_packages_pipeline() +
        [verify_release_pipeline()] +
        rgm() +
        [windows_test_backend({
            "event": ["promote"],
            "target": ["test-windows"],
        }, "oss", "testing")] +
        version_branch_pipelines() +
        integration_test_pipelines() +
        publish_ci_windows_test_image_pipeline() +
        cronjobs() +
        secrets()
    )
