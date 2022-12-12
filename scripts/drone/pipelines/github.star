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

def publish_github_step():
    return {
        'name': 'publish-github',
        'image': publish_image,
        'commands': ['./bin/build publish github --repo $${GH_REGISTRY} --create'],
        'depends_on': ['fetch-images-enterprise2'],
        'environment': {
            'GH_TOKEN': from_secret('github_token'),
            'GH_REGISTRY': from_secret('gh_registry'),
        },
    }

def publish_github_pipeline(mode):
    trigger = {
        'event': ['promote'],
        'target': [mode],
    }
    return [pipeline(
        name='publish-github-{}'.format(mode), trigger=trigger, steps=[compile_build_cmd(), fetch_images_step('enterprise2'), publish_github_step()], edition="", environment = {'EDITION': 'enterprise2'}
    ),]
