load('scripts/vault.star', 'from_secret')

def cronjobs(edition):
    if edition != 'oss':
        edition='grafana-enterprise'
    else:
        edition='grafana'

    trigger = {
        'event': 'cron',
        'cron': 'nightly',
    }
    platform_conf = {
        'os': 'linux',
        'arch': 'amd64',
    }
    steps=[
        scan_docker_image_unkown_low_medium_vulnerabilities_step(edition),
        scan_docker_image_high_critical_vulnerabilities_step(edition),
        slack_job_failed_step('grafana-backend'),
    ]
    return [
        {
            'kind': 'pipeline',
            'type': 'docker',
            'platform': platform_conf,
            'name': 'scan-docker-images',
            'trigger': trigger,
            'services': [],
            'steps': steps,
        }
    ]

def scan_docker_image_unkown_low_medium_vulnerabilities_step(edition):
    tags=['latest', 'main', 'latest-ubuntu', 'main-ubuntu']
    commands=[]
    for t in tags:
        commands.append('trivy --exit-code 0 --severity UNKNOWN,LOW,MEDIUM grafana/{}:{}'.format(edition,t))
    return {
        'name': 'scan-docker-images-unkown-low-medium-vulnerabilities',
        'image': 'aquasec/trivy:0.18.3',
        'commands': commands,
    }

def scan_docker_image_high_critical_vulnerabilities_step(edition):
    tags=['latest', 'main', 'latest-ubuntu', 'main-ubuntu']
    commands=[]
    for t in tags:
        commands.append('trivy --exit-code 1 --severity HIGH,CRITICAL grafana/{}:{}'.format(edition,t))

    return {
        'name': 'scan-docker-images-high-critical-vulnerabilities',
        'image': 'aquasec/trivy:0.18.3',
        'commands': commands,
    }

def slack_job_failed_step(channel):
    return {
        'name': 'slack-notify-failure',
        'image': 'plugins/slack',
        'settings': {
            'webhook': from_secret('slack_webhook_backend'),
            'channel': channel,
            'template': 'Nightly docker image scan job for {{repo.name}} failed: {{build.link}}',
        },
        'when': {
            'status': 'failure'
        }
    }
