load(
    "scripts/drone/utils/images.star",
    "images",
)

def prometheus_devenv_step():
    """Sets up Prometheus resources used in e2e tests

    Returns:
      Drone step.
    """
    return {
        "name": "setup-prometheus-devenv",
        "image": images["node"],
        "commands": [
            "apk add --update make",
            "make devenv sources=prometheus",
        ],
        "environment": {
            "DRONE_BUILD_EVENT": "pull_request",
        },
        "volumes": [
            {
                "name": "prometheus-data",
                "path": "/var/lib/prometheus",
            },
        ],
        "depends_on": [
            "clone",
        ],
    }

def cache_cleanup_step():
    """Rotate cache files when total size exceeds 1GB

    Returns:
      Drone step.
    """
    return {
        "name": "cleanup-prometheus-cache",
        "image": images["node"],
        "commands": [
            'while [ "$(du -sm /var/lib/drone/cache/prometheus-devenv | cut -f1)" -gt 1024 ]; do',
            '    echo "Cache size exceeds 1GB, removing oldest files..."',
            '    find /var/lib/drone/cache/prometheus-devenv -type f -printf "%T+ %p\n" | sort | head -n 10 | cut -d" " -f2- | xargs rm -f',
            '    find /var/lib/drone/cache/prometheus-devenv -type d -empty -delete',
            'done',
        ],
        "volumes": [
            {
                "name": "prometheus-data",
                "path": "/var/lib/drone/cache/prometheus-devenv",
            },
        ],
        "depends_on": [
            "setup-prometheus-devenv",
        ],
    }
