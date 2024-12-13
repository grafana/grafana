"""
Ensures that e2e/plugin-e2e/prometheus tests have access to the `gdev-prometheus` data source.
"""
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

load(
    'scripts/drone/steps/devenv-prometheus.star',
    'prometheus_devenv_step',
    'cache_cleanup_step',
)

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
