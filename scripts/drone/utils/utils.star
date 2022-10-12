load(
    'scripts/drone/steps/lib.star',
    'download_grabpl_step',
    'slack_step',
)

load('scripts/drone/vault.star', 'from_secret', 'github_token', 'pull_secret', 'drone_token')

failure_template = 'Build {{build.number}} failed for commit: <https://github.com/{{repo.owner}}/{{repo.name}}/commit/{{build.commit}}|{{ truncate build.commit 8 }}>: {{build.link}}\nBranch: <https://github.com/{{ repo.owner }}/{{ repo.name }}/commits/{{ build.branch }}|{{ build.branch }}>\nAuthor: {{build.author}}'
drone_change_template = '`.drone.yml` and `starlark` files have been changed on the OSS repo, by: {{build.author}}. \nBranch: <https://github.com/{{ repo.owner }}/{{ repo.name }}/commits/{{ build.branch }}|{{ build.branch }}>\nCommit hash: <https://github.com/{{repo.owner}}/{{repo.name}}/commit/{{build.commit}}|{{ truncate build.commit 8 }}>'

def pipeline(
    name, edition, trigger, steps, services=[], platform='linux', depends_on=[], environment=None, volumes=[],
    ):
    if platform != 'windows':
        platform_conf = {
            'platform': {
                'os': 'linux',
                'arch': 'amd64'
            },
            # A shared cache is used on the host
            # To avoid issues with parallel builds, we run this repo on single build agents
            'node': {
                'type': 'no-parallel'
            }
        }
    else:
        platform_conf = {
            'platform': {
                'os': 'windows',
                'arch': 'amd64',
                'version': '1809',
            }
        }

    pipeline = {
        'kind': 'pipeline',
        'type': 'docker',
        'name': name,
        'trigger': trigger,
        'services': services,
        'steps': steps,
        'clone': {
            'retries': 3,
        },
        'volumes': [{
            'name': 'docker',
            'host': {
                'path': '/var/run/docker.sock',
            },
        }],
        'depends_on': depends_on,
        'image_pull_secrets': [pull_secret],
    }
    if environment:
        pipeline.update({
            'environment': environment,
        })

    pipeline['volumes'].extend(volumes)
    pipeline.update(platform_conf)

    if edition in ('enterprise', 'enterprise2'):
        # We have a custom clone step for enterprise
        pipeline['clone'] = {
            'disable': True,
        }

    return pipeline

def notify_pipeline(name, slack_channel, trigger, depends_on=[], template=None, secret=None):
    trigger = dict(trigger)
    return {
        'kind': 'pipeline',
        'type': 'docker',
        'platform': {
            'os': 'linux',
            'arch': 'amd64',
        },
        'name': name,
        'trigger': trigger,
        'steps': [
            slack_step(slack_channel, template, secret),
        ],
        'clone': {
            'retries': 3,
        },
        'depends_on': depends_on,
    }


