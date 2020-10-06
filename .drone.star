load('scripts/lib.star', 'pr_pipelines', 'master_pipelines')

def main(ctx):
    edition = 'oss'
    return pr_pipelines(edition=edition) + master_pipelines(edition=edition)
