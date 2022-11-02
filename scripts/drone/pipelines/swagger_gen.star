load(
    'scripts/drone/steps/lib.star',
    'go_image',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)

load(
    'scripts/drone/vault.star',
    'github_token',
    'from_secret',
)

def clone_pr_branch(edition, ver_mode):
    if edition in ['enterprise', 'enterprise2']:
        return None
    
    if ver_mode != "pr":
        return None

    committish = '${DRONE_SOURCE_BRANCH}'
    return {
        'name': 'clone-pr-branch',
        'image': go_image,
        'commands': [
            'git clone https://github.com/grafana/grafana.git grafana',
            'cd grafana',
            'git checkout {}'.format(committish),
        ],
    }

def clone_enterprise_step(edition, ver_mode):
    if edition in ['enterprise', 'enterprise2']:
        return None
    
    if ver_mode != "pr":
        return None

    committish = '${DRONE_SOURCE_BRANCH}'
    return {
        'name': 'clone-pr-enterprise-branch',
        'image': go_image,
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

def swagger_gen_step(edition, ver_mode):
    if edition in ['enterprise', 'enterprise2']:
        return None
    
    if ver_mode != "pr":
        return None

    committish = '${DRONE_SOURCE_BRANCH}'
    return {
        'name': 'swagger-gen',
        'image': go_image,
        'commands': [
            'cd grafana',
	        'make clean-api-spec && make openapi3-gen',
	        'for f in public/api-spec.json public/api-merged.json public/openapi3.json; do git add $f; done',
	        'if git diff --name-only --cached; then git commit -m "Update OpenAPI and Swagger" --author="Grot (@grafanabot) <43478413+grafanabot@users.noreply.github.com>" && git push https://github.com/grafana/grafana.git {}; else echo "Everything seems up to date!"; fi'.format(committish),
        ],
        'depends_on': [
            'clone-pr-enterprise-branch',
        ],
    }

def swagger_gen(trigger, edition, ver_mode):
	test_steps = [
		clone_pr_branch(edition=edition, ver_mode=ver_mode),
		clone_enterprise_step(edition=edition, ver_mode=ver_mode),
		swagger_gen_step(edition=edition, ver_mode=ver_mode)
	]

	p = pipeline(
		name='{}-swagger-gen'.format(ver_mode), edition=edition, trigger=trigger, services=[], steps=test_steps,
	)
	
	p['clone'] = {
            'disable': True,
        }

	return p
