"""
This module contains a single function push_to_maintained_branch_pipelines that
returns the pipelines used on all pushes to maintained branches.
For detailed documentation of pipeline behaviors, refer the the function docstring.
"""

load("scripts/drone/utils/utils.star", "pipeline")
load(
    "scripts/drone/steps/lib.star",
    "build_docs_archive_step",
    "upload_docs_archive_step",
)

def push_to_maintained_branch_pipelines():
    """Generate pipelines used on all pushes to maintained branches.

    A branch is considered maintained if it is satisfies any of the following conditions:
      - is the 'main' branch
      - is a version branch (matching the regexp v[0-9]+\\.[0-9]+\\.x)
      - is a release branch (matching the regexp release-.+)

    Returns:
      List of Drone pipelines.
    """
    return [
        pipeline(
            name = "push-to-maintained-branch",
            edition = None,
            steps = [
                build_docs_archive_step(),
                upload_docs_archive_step(),
            ],
            trigger = {
                "branch": [
                    "main",
                    # TODO: what glob patterns are supported by Drone?
                    "v[0-9]+.[0-9]+.[0-9]+",
                    "release-*",
                ],
                "event": ["push"],
            },
        ),
    ]
