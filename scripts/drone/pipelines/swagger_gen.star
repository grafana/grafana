load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)

load(
    'scripts/drone/vault.star',
    'from_secret',
)

load(
    "scripts/drone/utils/images.star",
    "images",
)

def clone_pr_branch(ver_mode):
    if edition in ['enterprise', 'enterprise2']:
        return None

    if ver_mode != "pr":
        return None

    committish = '${DRONE_SOURCE_BRANCH}'
    return {
        'name': 'clone-pr-branch',
        'image': images["go"],
        'commands': [
            'git clone https://github.com/grafana/grafana.git grafana',
            'cd grafana',
            'git checkout {}'.format(committish),
        ],
    }

def clone_enterprise_step(ver_mode):
    if edition in ['enterprise', 'enterprise2']:
        return None

    if ver_mode != "pr":
        return None

    committish = '${DRONE_SOURCE_BRANCH}'
    return {
        'name': 'clone-pr-enterprise-branch',
        'image': images["go"],
        'environment': {
            'GITHUB_TOKEN': from_secret('github_token_pr'),
        },
        'commands': [
            'git clone "https://$${GITHUB_TOKEN}@github.com/grafana/grafana-enterprise.git"',
            'cd grafana-enterprise',
            'if git show-ref refs/heads/{}; then git checkout {}; else git checkout main; fi'.format(committish, committish),
	        './dev.sh',
        ],
        'depends_on': [
            'clone-pr-branch',
        ],
    }
# def enterprise_setup_step(source = "${DRONE_SOURCE_BRANCH}", canFail = True, isPromote = False):
#     """Setup the enterprise source into the ./grafana-enterprise directory.

#     Args:
#       source: controls which revision of grafana-enterprise is checked out, if it exists. The name 'source' derives from the 'source branch' of a pull request.
#       canFail: controls whether the step can fail. This is useful for pull requests where the enterprise source may not exist.
#       isPromote: controls whether or not this step is being used in a promote pipeline. If it is, then the clone enterprise step will not check if the pull request is a fork.
#     Returns:
#         Drone step.
#     """
#     step = clone_enterprise_step_pr(source = source, target = "${DRONE_TARGET_BRANCH}", canFail = canFail, location = "../grafana-enterprise", isPromote = isPromote)
#     step["commands"] += [
#         "cd ../",
#         "ln -s src grafana",
#         "cd ./grafana-enterprise",
#         "./build.sh",
#     ]

#     return step

# def clone_enterprise_step_pr(source = "${DRONE_COMMIT}", target = "main", canFail = False, location = "grafana-enterprise", isPromote = False):
#     """Clone the enterprise source into the ./grafana-enterprise directory.

#     Args:
#       source: controls which revision of grafana-enterprise is checked out, if it exists. The name 'source' derives from the 'source branch' of a pull request.
#       target: controls which revision of grafana-enterprise is checked out, if it 'source' does not exist. The name 'target' derives from the 'target branch' of a pull request. If this does not exist, then 'main' will be checked out.
#       canFail: controls whether or not this step is allowed to fail. If it fails and this is true, then the pipeline will continue. canFail is used in pull request pipelines where enterprise may be cloned but may not clone in forks.
#       location: the path where grafana-enterprise is cloned.
#       isPromote: controls whether or not this step is being used in a promote pipeline. If it is, then the step will not check if the pull request is a fork.
#     Returns:
#       Drone step.
#     """

#     if isPromote:
#         check = []
#     else:
#         check = [
#             'is_fork=$(curl "https://$GITHUB_TOKEN@api.github.com/repos/grafana/grafana/pulls/$DRONE_PULL_REQUEST" | jq .head.repo.fork)',
#             'if [ "$is_fork" != false ]; then return 1; fi',  # Only clone if we're confident that 'fork' is 'false'. Fail if it's also empty.
#         ]

#     step = {
#         "name": "clone-enterprise",
#         "image": images["git"],
#         "environment": {
#             "GITHUB_TOKEN": from_secret("github_token"),
#         },
#         "commands": [
#             "apk add --update curl jq bash",
#         ] + check + [
#             'git clone "https://$${GITHUB_TOKEN}@github.com/grafana/grafana-enterprise.git" ' + location,
#             "cd {}".format(location),
#             'if git checkout {0}; then echo "checked out {0}"; elif git checkout {1}; then echo "git checkout {1}"; else git checkout main; fi'.format(source, target),
#         ],
#     }

#     if canFail:
#         step["failure"] = "ignore"

#     return step

def swagger_gen_step(edition, ver_mode):
    if edition in ['enterprise', 'enterprise2']:
        return None

    if ver_mode != "pr":
        return None

    committish = '${DRONE_SOURCE_BRANCH}'
    return {
        'name': 'swagger-gen',
        'image': images["go"],
        'environment': {
            'GITHUB_TOKEN': from_secret('github_token'),
        },
        'commands': [
            'cd grafana',
	        'make clean-api-spec && make openapi3-gen',
	        'for f in public/api-spec.json public/api-merged.json public/openapi3.json; do git add $f; done',
	        'if [ -z "$(git diff --name-only --cached)" ]; then echo "Everything seems up to date!"; else git commit -m "Update OpenAPI and Swagger" --author="Grot (@grafanabot) <43478413+grafanabot@users.noreply.github.com>" && git push {} {}; fi'.format("https://$${GITHUB_TOKEN}@github.com/grafana/grafana.git", committish),
        ],
        'depends_on': [
            'clone-pr-enterprise-branch',
        ],
    }

def swagger_gen(trigger, ver_mode):
	test_steps = [
		clone_pr_branch(ver_mode=ver_mode),
		clone_enterprise_step(ver_mode=ver_mode),
		swagger_gen_step(edver_mode=ver_mode)
	]

	p = pipeline(
		name='{}-swagger-gen'.format(ver_mode), trigger=trigger, services=[], steps=test_steps,
	)

	p['clone'] = {
            'disable': True,
        }

	return p