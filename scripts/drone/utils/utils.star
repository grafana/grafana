load(
    'scripts/drone/steps/lib.star',
    'initialize_step',
    'download_grabpl',
    'slack_step',
)

load('scripts/drone/vault.star', 'from_secret', 'github_token', 'pull_secret', 'drone_token')

def pipeline(
    name, edition, trigger, steps, ver_mode, services=[], platform='linux', depends_on=[],
    is_downstream=False, install_deps=True,
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

    grabpl_step = [download_grabpl()]

    pipeline = {
        'kind': 'pipeline',
        'type': 'docker',
        'name': name,
        'trigger': trigger,
        'services': services,
        'steps': grabpl_step + initialize_step(
            edition, platform, is_downstream=is_downstream, install_deps=install_deps, ver_mode=ver_mode,
        ) + steps,
        'depends_on': depends_on,
    }
    pipeline.update(platform_conf)

    if edition in ('enterprise', 'enterprise2'):
        pipeline['image_pull_secrets'] = [pull_secret]
        # We have a custom clone step for enterprise
        pipeline['clone'] = {
            'disable': True,
        }

    return pipeline

def notify_pipeline(name, slack_channel, trigger, depends_on=[]):
    trigger = dict(trigger, status = ['failure'])
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
            slack_step(slack_channel),
        ],
        'depends_on': depends_on,
    }


