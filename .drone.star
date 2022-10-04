# To generate the .drone.yml file:
# 1. Modify the *.star definitions
# 2. Login to drone and export the env variables (token and server) shown here: https://drone.grafana.net/account
# 3. Run `make drone`
# More information about this process here: https://github.com/grafana/deployment_tools/blob/master/docs/infrastructure/drone/signing.md

load('scripts/drone/events/pr.star', 'pr_pipelines')
load('scripts/drone/events/main.star', 'main_pipelines')
load('scripts/drone/pipelines/docs.star', 'docs_pipelines')
load('scripts/drone/events/release.star', 'release_pipelines', 'publish_artifacts_pipelines', 'publish_npm_pipelines', 'publish_packages_pipeline', 'artifacts_page_pipeline')
load('scripts/drone/pipelines/publish_images.star', 'publish_image_pipelines_public', 'publish_image_pipelines_security')
load('scripts/drone/version.star', 'version_branch_pipelines')
load('scripts/drone/events/cron.star', 'cronjobs')
load('scripts/drone/vault.star', 'secrets')

def main(ctx):
    edition = 'oss'
    return pr_pipelines(edition=edition) + main_pipelines(edition=edition) + release_pipelines() + \
        publish_image_pipelines_public() + publish_image_pipelines_security() + \
        publish_artifacts_pipelines('security') + publish_artifacts_pipelines('public') + \
        publish_npm_pipelines('public') + publish_packages_pipeline() + artifacts_page_pipeline() + \
        version_branch_pipelines() + cronjobs(edition=edition) + secrets()
