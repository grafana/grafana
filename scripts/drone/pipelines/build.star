load('scripts/drone/init/init.star', 'build_image', 'enterprise2_suffix', 'test_release_ver', 'grafana_docker_image')
load('scripts/drone/vault.star', 'from_secret', 'github_token', 'gcp_upload_artifacts_key')

def build_backend_step(edition, ver_mode, variants=None, is_downstream=False):
    variants_str = ''
    if variants:
        variants_str = ' --variants {}'.format(','.join(variants))

    # TODO: Convert number of jobs to percentage
    if ver_mode == 'release':
        env = {
            'GITHUB_TOKEN': from_secret(github_token),
        }
        cmds = [
            './bin/grabpl build-backend --jobs 8 --edition {} --github-token $${{GITHUB_TOKEN}} --no-pull-enterprise ${{DRONE_TAG}}'.format(
                edition,
            ),
        ]
    elif ver_mode == 'test-release':
        env = {
            'GITHUB_TOKEN': from_secret(github_token),
        }
        cmds = [
            './bin/grabpl build-backend --jobs 8 --edition {} --github-token $${{GITHUB_TOKEN}} --no-pull-enterprise {}'.format(
                edition, test_release_ver,
            ),
        ]
    else:
        if not is_downstream:
            build_no = '${DRONE_BUILD_NUMBER}'
        else:
            build_no = '$${SOURCE_BUILD_NUMBER}'
        env = {}
        cmds = [
            './bin/grabpl build-backend --jobs 8 --edition {} --build-id {}{} --no-pull-enterprise'.format(
                edition, build_no, variants_str,
            ),
        ]

    return {
        'name': 'build-backend' + enterprise2_suffix(edition),
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'environment': env,
        'commands': cmds,
    }


def build_frontend_step(edition, ver_mode, is_downstream=False):
    if not is_downstream:
        build_no = '${DRONE_BUILD_NUMBER}'
    else:
        build_no = '$${SOURCE_BUILD_NUMBER}'

    # TODO: Use percentage for num jobs
    if ver_mode == 'release':
        cmds = [
            './bin/grabpl build-frontend --jobs 8 --github-token $${GITHUB_TOKEN} --no-install-deps ' + \
            '--edition {} --no-pull-enterprise ${{DRONE_TAG}}'.format(edition),
            ]
    elif ver_mode == 'test-release':
        cmds = [
            './bin/grabpl build-frontend --jobs 8 --github-token $${GITHUB_TOKEN} --no-install-deps ' + \
            '--edition {} --no-pull-enterprise {}'.format(edition, test_release_ver),
            ]
    else:
        cmds = [
            './bin/grabpl build-frontend --jobs 8 --no-install-deps --edition {} '.format(edition) + \
            '--build-id {} --no-pull-enterprise'.format(build_no),
            ]

    return {
        'name': 'build-frontend',
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'environment': {
            'NODE_OPTIONS': '--max_old_space_size=8192',
        },
        'commands': cmds,
    }


def build_frontend_docs_step(edition):
    return {
        'name': 'build-frontend-docs',
        'image': build_image,
        'depends_on': [
            'build-frontend'
        ],
        'commands': [
            './scripts/ci-reference-docs-lint.sh ci',
        ]
    }


def build_plugins_step(edition, sign=False):
    if sign:
        env = {
            'GRAFANA_API_KEY': from_secret('grafana_api_key'),
        }
        sign_args = ' --sign --signing-admin'
    else:
        env = None
        sign_args = ''
    return {
        'name': 'build-plugins',
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'environment': env,
        'commands': [
            # TODO: Use percentage for num jobs
            './bin/grabpl build-plugins --jobs 8 --edition {} --no-install-deps{}'.format(edition, sign_args),
        ],
    }

def build_storybook_step(edition, ver_mode):
    if edition in ('enterprise', 'enterprise2') and ver_mode in ('release', 'test-release'):
        return None

    return {
        'name': 'build-storybook',
        'image': build_image,
        'depends_on': [
            # Best to ensure that this step doesn't mess with what's getting built and packaged
            'build-frontend',
        ],
        'environment': {
            'NODE_OPTIONS': '--max_old_space_size=4096',
        },
        'commands': [
            'yarn storybook:build',
            './bin/grabpl verify-storybook',
        ],
    }

def build_docs_website_step():
    return {
        'name': 'build-docs-website',
        # Use latest revision here, since we want to catch if it breaks
        'image': 'grafana/docs-base:latest',
        'depends_on': [
            'build-frontend-docs',
        ],
        'commands': [
            'mkdir -p /hugo/content/docs/grafana',
            'cp -r docs/sources/* /hugo/content/docs/grafana/latest/',
            'cd /hugo && make prod',
        ],
    }

def build_docker_images_step(edition, ver_mode, archs=None, ubuntu=False, publish=False):
    if ver_mode == 'test-release':
        publish = False

    ubuntu_sfx = ''
    if ubuntu:
        ubuntu_sfx = '-ubuntu'

    settings = {
        'dry_run': not publish,
        'edition': edition,
        'ubuntu': ubuntu,
    }

    if publish:
        settings['username'] = from_secret('docker_user')
        settings['password'] = from_secret('docker_password')
    if archs:
        settings['archs'] = ','.join(archs)
    return {
        'name': 'build-docker-images' + ubuntu_sfx,
        'image': grafana_docker_image,
        'depends_on': ['copy-packages-for-docker'],
        'settings': settings,
    }
