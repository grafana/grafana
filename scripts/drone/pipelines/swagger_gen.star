"""
This module returns all pipelines used in OpenAPI specification generation of Grafana HTTP APIs
"""

load(
    "scripts/drone/steps/github.star",
    "github_app_generate_token_step",
    "github_app_pipeline_volumes",
)
load(
    "scripts/drone/steps/lib.star",
    "enterprise_setup_step",
)
load(
    "scripts/drone/utils/images.star",
    "images",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

def swagger_gen_step(ver_mode):
    if ver_mode != "pr":
        return None

    return {
        "name": "swagger-gen",
        "image": images["go"],
        "commands": [
            "apk add --update git make",
            "make swagger-clean && make openapi3-gen",
            "for f in public/api-merged.json public/openapi3.json; do git add $f; done",
            'if [ -z "$(git diff --name-only --cached)" ]; then echo "Everything seems up to date!"; else git diff --cached && echo "Please ensure the branch is up-to-date, then regenerate the specification by running make swagger-clean && make openapi3-gen" && return 1; fi',
        ],
        "depends_on": [
            "clone-enterprise",
        ],
    }

def swagger_gen(ver_mode, source = "${DRONE_SOURCE_BRANCH}"):
    test_steps = [
        github_app_generate_token_step(),
        enterprise_setup_step(source = source, canFail = True),
        swagger_gen_step(ver_mode = ver_mode),
    ]

    p = pipeline(
        name = "{}-swagger-gen".format(ver_mode),
        trigger = {
            "event": ["pull_request"],
        },
        services = [],
        steps = test_steps,
        volumes = github_app_pipeline_volumes(),
    )

    return p
