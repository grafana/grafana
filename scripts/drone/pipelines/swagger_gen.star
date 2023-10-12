"""
This module returns all pipelines used in OpenAPI specification generation of Grafana HTTP APIs
"""

load(
    "scripts/drone/steps/lib.star",
    "clone_enterprise_step_pr",
)
load(
    "scripts/drone/utils/images.star",
    "images",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)
load(
    "scripts/drone/vault.star",
    "from_secret",
)

def clone_pr_branch(ver_mode):
    """Clones the PR branch, in contrast to the default cloning which checks out the target branch main and merges the changes on top.

    Args:
        ver_mode: ?

    Returns:
      Drone step.
    """
    if ver_mode != "pr":
        return None

    source = "${DRONE_SOURCE_BRANCH}"
    return {
        "name": "clone-pr-branch",
        "image": images["go"],
        "commands": [
            "apk add --update git",
            "echo 'listing before cloning'",
            "ls -l",
            "cat Makefile",
            "echo 'cloning repo'",
            "git clone https://github.com/grafana/grafana.git",
            "echo 'cloned repo'",
            "cd grafana",
            "echo 'listing...'",
            "ls -l",
            "pwd",
            "cat Makefile",
            "git checkout {}".format(source),
        ],
    }

def swagger_gen_step(ver_mode):
    if ver_mode != "pr":
        return None

    return {
        "name": "swagger-gen",
        "image": images["go"],
        "environment": {
            "GITHUB_TOKEN": from_secret("github_token"),
        },
        "commands": [
            "apk add --update git make",
            "pwd",
            "echo 'listing...'",
            "ls -l",
            "pwd",
            "cat Makefile",
            "make swagger-clean && make openapi3-gen",
            "for f in public/api-merged.json public/openapi3.json; do git add $f; done",
            'if [ -z "$(git diff --name-only --cached)" ]; then echo "Everything seems up to date!"; else echo "please regenerate specification by running make swagger-clean && make openapi3-gen" return 1; fi',
        ],
        "depends_on": [
            "clone-enterprise",
        ],
    }

def swagger_gen(trigger, ver_mode, source = "${DRONE_SOURCE_BRANCH}"):
    test_steps = [
        clone_enterprise_step_pr(source = source),
        swagger_gen_step(ver_mode = ver_mode),
    ]

    p = pipeline(
        name = "{}-swagger-gen".format(ver_mode),
        trigger = trigger,
        services = [],
        steps = test_steps,
    )

    return p
