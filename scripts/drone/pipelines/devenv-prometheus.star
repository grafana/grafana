"""
Ensures that e2e/plugin-e2e/prometheus tests have access to the `gdev-prometheus` data source.
"""

load(
    "scripts/drone/steps/lib.star",
    "download_grabpl_step",
    "pipeline",
    "setup_step",
)
load(
    "scripts/drone/steps/prometheus.star",
    "cache_cleanup_step",
    "prometheus_devenv_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline_trigger",
)

def prometheus_devenv_pipeline():
    init_steps = [
        download_grabpl_step(),
        setup_step(),
        prometheus_devenv_step(),
    ]

    cleanup_steps = [cache_cleanup_step()]

    return pipeline(
        name = "prometheus-devenv",
        edition = "oss",
        trigger = pipeline_trigger(),
        services = [],
        steps = init_steps + cleanup_steps,
        volumes = [
            {
                "name": "prometheus-data",
                "host": {
                    "path": "/var/lib/drone/cache/prometheus-devenv",
                },
            },
            {
                "name": "docker",
                "host": {
                    "path": "/var/run/docker.sock",
                },
            },
        ],
    )
