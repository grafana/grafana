load(
    'scripts/drone/steps/lib.star',
    'pipeline',
    'setup_step',
    'download_grabpl_step',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline_trigger',
)

def cache_cleanup_step():
    return {
        'name': 'cleanup-prometheus-cache',
        'image': 'grafana/build-container:1.7.3',
        'commands': [
            # Rotate cache files when total size exceeds 1GB
            'while [ "$(du -sm /var/lib/drone/cache/prometheus-devenv | cut -f1)" -gt 1024 ]; do',
            '    echo "Cache size exceeds 1GB, removing oldest files..."',
            '    find /var/lib/drone/cache/prometheus-devenv -type f -printf "%T+ %p\n" | sort | head -n 10 | cut -d" " -f2- | xargs rm -f',
            '    find /var/lib/drone/cache/prometheus-devenv -type d -empty -delete',
            'done',
        ],
        'volumes': [
            {
                'name': 'prometheus-data',
                'path': '/var/lib/drone/cache/prometheus-devenv',
            },
        ],
        # Run after the devenv step to clean up if necessary
        'depends_on': [
            'setup-prometheus-devenv',
        ],
    }

def prometheus_devenv_step():
    return {
        'name': 'setup-prometheus-devenv',
        'image': 'grafana/build-container:1.7.3',
        'commands': [
            'make devenv sources=prometheus',
        ],
        'environment': {
            'DRONE_BUILD_EVENT': 'pull_request',
        },
        'volumes': [
            {
                'name': 'prometheus-data',
                'path': '/var/lib/prometheus',
            },
        ],
        'depends_on': [
            'clone',
        ],
    }

def prometheus_devenv_pipeline():
    environment = {
        'EDITION': 'oss',
    }

    init_steps = [
        download_grabpl_step(),
        setup_step(),
        prometheus_devenv_step(),
    ]

    cleanup_steps = [cache_cleanup_step()]

    return pipeline(
        name='prometheus-devenv',
        edition="oss",
        trigger=pipeline_trigger(),
        services=[],
        steps=init_steps + cleanup_steps,
        volumes=[
            {
                'name': 'prometheus-data',
                'host': {
                    'path': '/var/lib/drone/cache/prometheus-devenv'
                },
            },
        ],
    )
