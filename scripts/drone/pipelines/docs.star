"""
This module returns all the pipelines used in the event of documentation changes along with supporting functions.
"""

load(
    "scripts/drone/steps/lib.star",
    "build_docs_website_step",
    "identify_runner_step",
    "verify_gen_cue_step",
    "yarn_install_step",
)
load(
    "scripts/drone/utils/images.star",
    "images",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

docs_paths = {
    "include": [
        "*.md",
        "docs/**",
        "packages/**/*.md",
        "latest.json",
    ],
}

def docs_pipelines(ver_mode, trigger):
    environment = {"EDITION": "oss"}
    steps = [
        identify_runner_step(),
        yarn_install_step(),
        lint_docs(),
        build_docs_website_step(),
        verify_gen_cue_step(),
    ]

    return pipeline(
        name = "{}-docs".format(ver_mode),
        trigger = trigger,
        services = [],
        steps = steps,
        environment = environment,
    )

def lint_docs():
    return {
        "name": "lint-docs",
        "image": images["node"],
        "depends_on": [
            "yarn-install",
        ],
        "environment": {
            "NODE_OPTIONS": "--max_old_space_size=8192",
        },
        "commands": [
            "yarn run prettier:checkDocs",
        ],
    }

def trigger_docs_main():
    return {
        "branch": "main",
        "event": [
            "push",
        ],
        "repo": [
            "grafana/grafana",
        ],
        "paths": docs_paths,
    }

def trigger_docs_pr():
    return {
        "event": [
            "pull_request",
        ],
        "repo": [
            "grafana/grafana",
        ],
        "paths": docs_paths,
    }
