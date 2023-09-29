"""
This module returns all pipelines used in OpenAPI specification generation of Grafana HTTP APIs
"""

load(
    "scripts/drone/utils/images.star",
    "images",
)
load(
    "scripts/drone/steps/lib.star",
    "clone_enterprise_step_pr",
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
        ver_mode: ??
    """
    if ver_mode != "pr":
        return None

    committish = "${DRONE_SOURCE_BRANCH}"
    return {
        "name": "clone-pr-branch",
        "image": images["go"],
        "commands": [
            "git clone https://github.com/grafana/grafana.git grafana",
            "cd grafana",
            "git checkout {}".format(committish),
        ],
    }

def swagger_gen_step(ver_mode):
    if ver_mode != "pr":
        return None

    committish = "${DRONE_SOURCE_BRANCH}"
    return {
        "name": "swagger-gen",
        "image": images["go"],
        "environment": {
            "GITHUB_TOKEN": from_secret("github_token"),
        },
        "commands": [
            "cd grafana",
            "make clean-api-spec && make openapi3-gen",
            "for f in public/api-spec.json public/api-merged.json public/openapi3.json; do git add $f; done",
            'if [ -z "$(git diff --name-only --cached)" ]; then echo "Everything seems up to date!"; else git commit -m "Update OpenAPI and Swagger" --author="Grot (@grafanabot) <43478413+grafanabot@users.noreply.github.com>" && git push {} {}; fi'.format("https://$${GITHUB_TOKEN}@github.com/grafana/grafana.git", committish),
        ],
        "depends_on": [
            "clone-pr-enterprise-branch",
        ],
    }

def swagger_gen(trigger, ver_mode):
    test_steps = [
        clone_pr_branch(ver_mode = ver_mode),
        clone_enterprise_step_pr(),
        swagger_gen_step(ver_mode = ver_mode),
    ]

    p = pipeline(
        name = "{}-swagger-gen".format(ver_mode),
        trigger = trigger,
        services = [],
        steps = test_steps,
    )

    p["clone"] = {
        "disable": True,
    }

    return p
