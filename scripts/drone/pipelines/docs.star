load(
    "scripts/drone/steps/lib.star",
    "build_docs_website_step",
    "build_image",
    "build_storybook_step",
    "codespell_step",
    "download_grabpl_step",
    "identify_runner_step",
    "lint_frontend_step",
    "test_frontend_step",
    "yarn_install_step",
)
load(
    "scripts/drone/services/services.star",
    "integration_test_services",
    "ldap_service",
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

def docs_pipelines(edition, ver_mode, trigger):
    environment = {"EDITION": edition}
    steps = [
        download_grabpl_step(),
        identify_runner_step(),
        yarn_install_step(),
        codespell_step(),
        lint_docs(),
        build_docs_website_step(),
    ]

    return pipeline(
        name = "{}-docs".format(ver_mode),
        edition = edition,
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
        "paths": docs_paths,
    }

def trigger_docs_pr():
    return {
        "event": [
            "pull_request",
        ],
        "paths": docs_paths,
    }
