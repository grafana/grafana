# To generate the .drone.yml file:
# 1. Modify the *.star definitions
# 2. Login to drone and export the env variables (token and server) shown here: https://drone.grafana.net/account
# 3. Run `make drone`
# More information about this process here: https://github.com/grafana/deployment_tools/blob/master/docs/infrastructure/drone/signing.md

load('scripts/drone/pipelines/pr.star', 'pr_pipelines')
load('scripts/drone/pipelines/main.star', 'main_pipelines')
load('scripts/drone/pipelines/release.star', 'release_pipelines', 'test_release_pipelines', 'publish_image_pipelines', 'publish_artifacts_pipelines', 'publish_npm_pipelines', 'publish_packages_pipeline')
load('scripts/drone/version.star', 'version_branch_pipelines')
load('scripts/drone/pipelines/cron.star', 'cronjobs')
load('scripts/drone/vault.star', 'secrets')

def main(ctx):
    edition = 'oss'
    return pr_pipelines(edition=edition) + main_pipelines(edition=edition) + release_pipelines() + \
        publish_image_pipelines('public') + publish_image_pipelines('security') + \
        publish_artifacts_pipelines('security') + publish_artifacts_pipelines('public') + \
        publish_npm_pipelines('public') + publish_packages_pipeline() + \
        test_release_pipelines() + version_branch_pipelines() + cronjobs(edition=edition) + secrets()
