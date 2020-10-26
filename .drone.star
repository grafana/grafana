load('scripts/pr.star', 'pr_pipelines')
load('scripts/master.star', 'master_pipelines')
load('scripts/release.star', 'release_pipelines', 'test_release_pipelines')
load('scripts/version.star', 'version_branch_pipelines')

def main(ctx):
    edition = 'oss'
    return pr_pipelines(edition=edition) + master_pipelines(edition=edition) + release_pipelines() + \
        test_release_pipelines() + version_branch_pipelines()
