load(
    'scripts/drone/steps/lib.star',
    'download_grabpl_step',
    'publish_images_step',
    'compile_build_cmd',
    'fetch_images_step',
    'publish_image',
)

load('scripts/drone/vault.star', 'from_secret')

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)

def publish_aws_marketplace_step():
    return {
        'name': 'publish-aws-marketplace',
        'image': publish_image,
        'commands': ['./bin/build publish aws --image grafana/grafana-enterprise-dev --repo grafana-labs/grafana-enterprise --product 1b97f7d0-f274-4cce-b5f4-910dbfa45535'],
        'depends_on': ['fetch-images-enterprise2'],
        'environment': {
            'AWS_REGION': from_secret('aws_region'),
            'AWS_ACCESS_KEY_ID': from_secret('aws_access_key_id'),
            'AWS_SECRET_ACCESS_KEY': from_secret('aws_secret_access_key'),
        },
        'volumes': [{'name': 'docker', 'path': '/var/run/docker.sock'}],
    }

def publish_aws_marketplace_pipeline(mode):
    trigger = {
        'event': ['promote'],
        'target': [mode],
    }
    return [pipeline(
        name='publish-aws-marketplace-{}'.format(mode), trigger=trigger, steps=[compile_build_cmd(), fetch_images_step('enterprise2'), publish_aws_marketplace_step()], edition="", environment = {'EDITION': 'enterprise2'}
    ),]
