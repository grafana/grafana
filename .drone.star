load('scripts/lib.star', 'pr_pipelines')

def main(ctx):
    return pr_pipelines(edition='oss')
