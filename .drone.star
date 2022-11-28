# To generate the .drone.yml file:
# 1. Modify the *.star definitions
# 2. Login to drone and export the env variables (token and server) shown here: https://drone.grafana.net/account
# 3. Run `make drone`
# More information about this process here: https://github.com/grafana/deployment_tools/blob/master/docs/infrastructure/drone/signing.md
"""
This module returns a Drone configuration including pipelines and secrets.
"""

load("scripts/drone/pipelines/docs_archive.star", "docs_archive_pipeline", "docs_release_pipeline")
load("scripts/drone/events/pr.star", "pr_pipelines")
load("scripts/drone/events/main.star", "main_pipelines")
load("scripts/drone/events/release.star", "artifacts_page_pipeline", "enterprise2_pipelines", "enterprise_pipelines", "oss_pipelines", "publish_artifacts_pipelines", "publish_npm_pipelines", "publish_packages_pipeline")
load("scripts/drone/pipelines/publish_images.star", "publish_image_pipelines_public", "publish_image_pipelines_security")
load("scripts/drone/version.star", "version_branch_pipelines")
load("scripts/drone/events/cron.star", "cronjobs")
load("scripts/drone/vault.star", "secrets")

def main(_ctx):
    edition = "oss"
    return artifacts_page_pipeline() + \
           cronjobs(edition = edition) + \
           [docs_archive_pipeline, docs_release_pipeline] + \
           enterprise2_pipelines() + \
           enterprise2_pipelines(prefix = "custom-", trigger = {"event": ["custom"]}) + \
           enterprise_pipelines() + \
           main_pipelines(edition = edition) + \
           oss_pipelines() + \
           pr_pipelines(edition = edition) + \
           publish_artifacts_pipelines("public") + \
           publish_artifacts_pipelines("security") + \
           publish_image_pipelines_public() + \
           publish_image_pipelines_security() + \
           publish_npm_pipelines("public") + \
           publish_packages_pipeline() + \
           secrets() + \
           version_branch_pipelines()
