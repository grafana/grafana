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
            "make swagger-clean && make openapi3-gen",
            "for f in public/api-merged.json public/openapi3.json; do git add $f; done",
            "git config --local user.email bot@grafana.com",
            "git config --local user.name grafanabot",
            "git commit --message 'Update swagger'",
            "git push origin"
        ],
        "depends_on": [
            "clone-enterprise",
        ],
    }

def swagger_gen(trigger, ver_mode, source = "${DRONE_SOURCE_BRANCH}"):
    test_steps = [
        clone_enterprise_step_pr(source = source, canFail = True),
        swagger_gen_step(ver_mode = ver_mode),
    ]

    p = pipeline(
        name = "{}-swagger-gen".format(ver_mode),
        trigger = trigger,
        services = [],
        steps = test_steps,
    )

    return p
