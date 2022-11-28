load(
    'scripts/drone/steps/lib.star',
    'download_grabpl_step',
    'publish_images_step',
    'compile_build_cmd',
    'fetch_images_step',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)


def publish_image_steps(edition, mode, docker_repo):
    additional_docker_repo = ""
    if edition == 'oss':
        additional_docker_repo='grafana/grafana-oss'
    steps = [
        download_grabpl_step(),
        compile_build_cmd(),
        fetch_images_step(edition),
        publish_images_step(edition, 'release', mode, docker_repo),
    ]
    if additional_docker_repo != "":
        steps.extend([publish_images_step(edition, 'release', mode, additional_docker_repo)])

    return steps

def publish_image_pipelines_public():
    mode='public'
    trigger = {
        'event': ['promote'],
        'target': [mode],
    }
    return [pipeline(
        name='publish-docker-oss-{}'.format(mode), trigger=trigger, steps=publish_image_steps(edition='oss',  mode=mode, docker_repo='grafana/grafana'), edition=""
    ), pipeline(
        name='publish-docker-enterprise-{}'.format(mode), trigger=trigger, steps=publish_image_steps(edition='enterprise',  mode=mode, docker_repo='grafana/grafana-enterprise'), edition=""
    ),]

def publish_image_pipelines_security():
    mode='security'
    trigger = {
        'event': ['promote'],
        'target': [mode],
    }
    return [pipeline(
        name='publish-docker-enterprise-{}'.format(mode), trigger=trigger, steps=publish_image_steps(edition='enterprise',  mode=mode, docker_repo='grafana/grafana-enterprise'), edition=""
    ),]
