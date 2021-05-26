load (
    'scripts/lib.star',
    'scan_docker_image_unkown_low_medium_vulnerabilities_step',
    'scan_docker_image_high_critical_vulnerabilities',
)
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
        scan_docker_image_high_critical_vulnerabilities(edition),
    ]
    return [
        {
            'kind': 'pipeline',
            'type': 'docker',
            'platform': platform_conf,
            'name': 'scan-docker-image',
            'trigger': trigger,
            'services': [],
            'steps': steps,
        }
    ] 