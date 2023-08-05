"""
This module returns the pipeline used for version branches.
"""

load(
    "scripts/drone/events/release.star",
    "oss_pipelines",
)

ver_mode = "release-branch"
trigger = {"ref": ["refs/heads/v[0-9]*"]}

def version_branch_pipelines():
    return (
        oss_pipelines(ver_mode = ver_mode, trigger = trigger)
    )
