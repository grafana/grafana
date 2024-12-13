load(
    'scripts/drone/steps/lib.star',
    'images',
)

def prometheus_devenv_step():
    return {
        'name': 'setup-prometheus-devenv',
        'image': images["node"],
        'commands': [
            'apk add --update make',
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

def cache_cleanup_step():
    return {
        'name': 'cleanup-prometheus-cache',
        'image': images["node"],
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
        'depends_on': [
            'setup-prometheus-devenv',
        ],
    }
