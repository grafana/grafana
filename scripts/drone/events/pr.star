"""
This module returns all pipelines used in the event of a pull request.
It also includes a function generating a PR trigger from a list of included and excluded paths.
"""

load(
    "scripts/drone/pipelines/build.star",
    "build_e2e",
)
load(
    "scripts/drone/pipelines/docs.star",
    "docs_pipelines",
    "trigger_docs_pr",
)
load(
    "scripts/drone/pipelines/verify_drone.star",
    "verify_drone",
)
load(
    "scripts/drone/pipelines/verify_starlark.star",
    "verify_starlark",
)

ver_mode = "pr"
trigger = {
    "event": [
        "pull_request",
    ],
    "paths": {
        "exclude": [
            "*.md",
            "docs/**",
            "latest.json",
        ],
    },
}

def pr_pipelines():
    return [
        verify_drone(
            get_pr_trigger(
                include_paths = ["scripts/drone/**", ".drone.yml", ".drone.star"],
            ),
            ver_mode,
        ),
        verify_starlark(
            get_pr_trigger(
                include_paths = ["scripts/drone/**", ".drone.star"],
            ),
            ver_mode,
        ),
        build_e2e(trigger, ver_mode),
        docs_pipelines(ver_mode, trigger_docs_pr()),
    ]

def get_pr_trigger(include_paths = None, exclude_paths = None):
    """Generates a trigger filter from the lists of included and excluded path patterns.

    This function is primarily intended to generate a trigger for code changes
    as the patterns 'docs/**' and '*.md' are always excluded.

    Args:
      include_paths: a list of path patterns using the same syntax as gitignore.
        Changes affecting files matching these path patterns trigger the pipeline.
      exclude_paths: a list of path patterns using the same syntax as gitignore.
        Changes affecting files matching these path patterns do not trigger the pipeline.

    Returns:
      Drone trigger.
    """
    paths_ex = ["docs/**", "*.md"]
    paths_in = []
    if include_paths:
        for path in include_paths:
            paths_in.extend([path])
    if exclude_paths:
        for path in exclude_paths:
            paths_ex.extend([path])
    return {
        "event": [
            "pull_request",
        ],
        "paths": {
            "exclude": paths_ex,
            "include": paths_in,
        },
    }
