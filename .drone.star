load('scripts/pr.star', 'pr_pipelines')
load('scripts/master.star', 'master_pipelines')
load('scripts/release.star', 'release_pipelines', 'test_release_pipelines')

def main(ctx):
    edition = 'oss'
    return pr_pipelines(edition=edition) + master_pipelines(edition=edition) + release_pipelines() + \
        test_release_pipelines()
