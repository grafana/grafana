load (
    'scripts/lib.star',
    'scan_docker_image_unkown_low_medium_vulnerabilities_step',
    'scan_docker_image_high_critical_vulnerabilities',
)
def cronjobs(edition):
    trigger = {
        'event': 'cron',
        'cron': 'nightly',
    }
    platform_conf = {
        'os': 'linux',
        'arch': 'amd64',
    }
    steps=[ 
        scan_docker_image_unkown_low_medium_vulnerabilities_step('grafana/grafana', 'latest'),
        scan_docker_image_unkown_low_medium_vulnerabilities_step('grafana/grafana', 'main'),
        scan_docker_image_unkown_low_medium_vulnerabilities_step('grafana/grafana', 'latest-ubuntu'),
        scan_docker_image_unkown_low_medium_vulnerabilities_step('grafana/grafana', 'main-ubuntu'),
        scan_docker_image_unkown_low_medium_vulnerabilities_step('grafana/grafana-enterprise', 'latest'),
        scan_docker_image_unkown_low_medium_vulnerabilities_step('grafana/grafana-enterprise', 'main'),
        scan_docker_image_unkown_low_medium_vulnerabilities_step('grafana/grafana-enterprise', 'latest-ubuntu'),
        scan_docker_image_unkown_low_medium_vulnerabilities_step('grafana/grafana-enterprise', 'main-ubuntu'),
        scan_docker_image_high_critical_vulnerabilities('grafana/grafana', 'latest'),
        scan_docker_image_high_critical_vulnerabilities('grafana/grafana', 'main'),
        scan_docker_image_high_critical_vulnerabilities('grafana/grafana', 'latest-ubuntu'),
        scan_docker_image_high_critical_vulnerabilities('grafana/grafana', 'main-ubuntu'),
        scan_docker_image_high_critical_vulnerabilities('grafana/grafana-enterprise', 'latest'),
        scan_docker_image_high_critical_vulnerabilities('grafana/grafana-enterprise', 'main'),
        scan_docker_image_high_critical_vulnerabilities('grafana/grafana-enterprise', 'latest-ubuntu'),
        scan_docker_image_high_critical_vulnerabilities('grafana/grafana-enterprise', 'main-ubuntu'),
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