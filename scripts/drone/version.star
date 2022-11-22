load(
    'scripts/drone/events/release.star',
    'oss_pipelines',
    'enterprise_pipelines',
    'enterprise2_pipelines',
)

ver_mode = 'release-branch'
trigger={'ref': ['refs/heads/v[0-9]*']}

def version_branch_pipelines():
    return oss_pipelines(ver_mode=ver_mode, trigger=trigger) + enterprise_pipelines(ver_mode=ver_mode, trigger=trigger) + enterprise2_pipelines(ver_mode=ver_mode, trigger=trigger)
