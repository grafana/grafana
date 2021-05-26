load('scripts/pr.star', 'pr_pipelines')
load('scripts/main.star', 'main_pipelines')
load('scripts/release.star', 'release_pipelines', 'test_release_pipelines')
load('scripts/version.star', 'version_branch_pipelines')
load('scripts/job.star', 'cronjobs')
load('scripts/vault.star', 'secrets')

def main(ctx):
    edition = 'oss'
    return pr_pipelines(edition=edition) + main_pipelines(edition=edition) + release_pipelines() + \
        test_release_pipelines() + version_branch_pipelines() + cronjobs(edition=edition) + secrets()
