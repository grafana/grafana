load(
    'scripts/drone/steps/lib.star',
    'identify_runner_step',
    'gen_version_step',
    'download_grabpl_step',
    'store_packages_step'
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)

def publish(trigger, ver_mode, edition):
    steps = [
        download_grabpl_step(),
        gen_version_step(ver_mode),
        identify_runner_step(),
        store_packages_step(edition=edition, ver_mode=ver_mode),
    ]
    return pipeline(
                   name='main-publish', edition=edition, trigger=dict(trigger, repo=['grafana/grafana']),
                   steps=steps,
                   depends_on=['main-test-frontend', 'main-test-backend', 'main-build-e2e-publish', 'main-integration-tests', 'main-windows', ],
               )
