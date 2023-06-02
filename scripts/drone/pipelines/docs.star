"""
This module returns all the pipelines used in the event of documentation changes along with supporting functions.
"""

load(
    "scripts/drone/steps/lib.star",
    "build_docs_website_step",
    "build_image",
    "codespell_step",
    "identify_runner_step",
    "yarn_install_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)
load(
    "scripts/drone/vault.star",
    "from_secret",
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
        codespell_step(),
        lint_docs(),
        build_docs_website_step(),
    ]

    return pipeline(
        name = "{}-docs".format(ver_mode),
        edition = "oss",
        trigger = trigger,
        services = [],
        steps = steps,
        environment = environment,
    )

def lint_docs():
    return {
        "name": "lint-docs",
        "image": build_image,
        "depends_on": [
            "yarn-install",
        ],
        "environment": {
            "NODE_OPTIONS": "--max_old_space_size=8192",
            "REVIEWDOG_GITHUB_API_TOKEN": from_secret("github_token"),
        },
        "commands": [
            "go install github.com/reviewdog/reviewdog/cmd/reviewdog@latest",
            "prettier --write 2>&1 docs/sources | reviewdog '--efm=%E[%trror] %f: %m (%l:%c)' --efm=%C[error]%r --efm=%Z[error]%r --efm=%-G%r --fail-on-error  --filter-mode=nofilter --level=info --name=prettier --reporter=local",
        ],
    }

def trigger_docs_main():
    return {
        "branch": "main",
        "event": [
            "push",
        ],
        "paths": docs_paths,
    }

def trigger_docs_pr():
    return {
        "event": [
            "pull_request",
        ],
        "paths": docs_paths,
    }
