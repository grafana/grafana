load('scripts/drone/utils/var.star', 'build_image', 'test_release_ver', 'publish_image')
load('scripts/drone/init/init.star', 'enterprise2_suffix', 'end_to_end_tests_deps')
load('scripts/drone/vault.star', 'from_secret', 'github_token', 'prerelease_bucket')


def package_step(edition, ver_mode, include_enterprise2=False, variants=None, is_downstream=False):
    deps = [
        'build-plugins',
        'build-backend',
        'build-frontend',
    ]
    if include_enterprise2:
        sfx = '-enterprise2'
        deps.extend([
            'build-backend' + sfx,
            ])

    variants_str = ''
    if variants:
        variants_str = ' --variants {}'.format(','.join(variants))

    if ver_mode in ('main', 'release', 'test-release', 'release-branch'):
        sign_args = ' --sign'
        env = {
            'GRAFANA_API_KEY': from_secret('grafana_api_key'),
            'GITHUB_TOKEN': from_secret(github_token),
            'GPG_PRIV_KEY': from_secret('gpg_priv_key'),
            'GPG_PUB_KEY': from_secret('gpg_pub_key'),
            'GPG_KEY_PASSWORD': from_secret('gpg_key_password'),
        }
        test_args = ''
    else:
        sign_args = ''
        env = None
        test_args = '. scripts/build/gpg-test-vars.sh && '

    # TODO: Use percentage for jobs
    if ver_mode == 'release':
        cmds = [
            '{}./bin/grabpl package --jobs 8 --edition {} '.format(test_args, edition) + \
            '--github-token $${{GITHUB_TOKEN}} --no-pull-enterprise{} ${{DRONE_TAG}}'.format(
                sign_args
            ),
            ]
    elif ver_mode == 'test-release':
        cmds = [
            '{}./bin/grabpl package --jobs 8 --edition {} '.format(test_args, edition) + \
            '--github-token $${{GITHUB_TOKEN}} --no-pull-enterprise{} {}'.format(
                sign_args, test_release_ver,
            ),
            ]
    else:
        if not is_downstream:
            build_no = '${DRONE_BUILD_NUMBER}'
        else:
            build_no = '$${SOURCE_BUILD_NUMBER}'
        cmds = [
            '{}./bin/grabpl package --jobs 8 --edition {} '.format(test_args, edition) + \
            '--build-id {} --no-pull-enterprise{}{}'.format(build_no, variants_str, sign_args),
            ]

    return {
        'name': 'package' + enterprise2_suffix(edition),
        'image': build_image,
        'depends_on': deps,
        'environment': env,
        'commands': cmds,
    }


def package_docker_images_step(edition, ver_mode, archs=None, ubuntu=False, publish=False):
    if ver_mode == 'test-release':
        publish = False

    cmd = './bin/grabpl build-docker --edition {} --shouldSave'.format(edition)
    ubuntu_sfx = ''
    if ubuntu:
        ubuntu_sfx = '-ubuntu'
        cmd += ' --ubuntu'

    if archs:
        cmd += ' -archs {}'.format(','.join(archs))

    return {
        'name': 'package-docker-images' + ubuntu_sfx,
        'image': 'google/cloud-sdk',
        'depends_on': ['copy-packages-for-docker'],
        'commands': [
            'printenv GCP_KEY | base64 -d > /tmp/gcpkey.json',
            'gcloud auth activate-service-account --key-file=/tmp/gcpkey.json',
            cmd
        ],
        'volumes': [{
            'name': 'docker',
            'path': '/var/run/docker.sock'
        }],
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
        },
    }

def upload_packages_step(edition, ver_mode, is_downstream=False):
    if ver_mode == 'main' and edition in ('enterprise', 'enterprise2') and not is_downstream:
        return None

    if ver_mode == 'release':
        packages_bucket = '$${{PRERELEASE_BUCKET}}/artifacts/downloads{}'.format(enterprise2_suffix(edition))
        cmd = './bin/grabpl upload-packages --edition {} --packages-bucket {}'.format(edition, packages_bucket)
    elif edition == 'enterprise2':
        cmd = './bin/grabpl upload-packages --edition {} --packages-bucket grafana-downloads-enterprise2'.format(edition)
    else:
        cmd = './bin/grabpl upload-packages --edition {} --packages-bucket grafana-downloads'.format(edition)

    deps = []
    if edition in 'enterprise2' or not end_to_end_tests_deps(edition):
        deps.extend([
            'package' + enterprise2_suffix(edition),
            ])
    else:
        deps.extend(end_to_end_tests_deps(edition))

    return {
        'name': 'upload-packages' + enterprise2_suffix(edition),
        'image': publish_image,
        'depends_on': deps,
        'environment': {
            'GCP_GRAFANA_UPLOAD_KEY': from_secret('gcp_key'),
            'PRERELEASE_BUCKET': from_secret('prerelease_bucket'),
        },
        'commands': [cmd, ],
    }


def store_packages_step(edition, ver_mode, is_downstream=False):
    if ver_mode == 'release':
        cmd = './bin/grabpl store-packages --edition {} --packages-bucket grafana-downloads --gcp-key /tmp/gcpkey.json ${{DRONE_TAG}}'.format(
            edition,
        )
    elif ver_mode == 'main':
        if not is_downstream:
            build_no = '${DRONE_BUILD_NUMBER}'
        else:
            build_no = '$${SOURCE_BUILD_NUMBER}'
        cmd = './bin/grabpl store-packages --edition {} --gcp-key /tmp/gcpkey.json --build-id {}'.format(
            edition, build_no,
        )
    else:
        fail('Unexpected version mode {}'.format(ver_mode))

    return {
        'name': 'store-packages-{}'.format(edition),
        'image': publish_image,
        'depends_on': [
            'grabpl',
        ],
        'environment': {
            'GRAFANA_COM_API_KEY': from_secret('grafana_api_key'),
            'GCP_KEY': from_secret('gcp_key'),
            'GPG_PRIV_KEY': from_secret('gpg_priv_key'),
            'GPG_PUB_KEY': from_secret('gpg_pub_key'),
            'GPG_KEY_PASSWORD': from_secret('gpg_key_password'),
        },
        'commands': [
            'printenv GCP_KEY | base64 -d > /tmp/gcpkey.json',
            cmd,
        ],
    }

def upload_cdn_step(edition, ver_mode):
    if ver_mode == "release":
        bucket = "$${PRERELEASE_BUCKET}/artifacts/static-assets"
    else:
        bucket = "grafana-static-assets"

    deps = []
    if edition in 'enterprise2':
        deps.extend([
            'package' + enterprise2_suffix(edition),
            ])
    else:
        deps.extend([
            'grafana-server',
        ])

    return {
        'name': 'upload-cdn-assets' + enterprise2_suffix(edition),
        'image': publish_image,
        'depends_on': deps,
        'environment': {
            'GCP_GRAFANA_UPLOAD_KEY': from_secret('gcp_key'),
            'PRERELEASE_BUCKET': from_secret(prerelease_bucket)
        },
        'commands': [
            './bin/grabpl upload-cdn --edition {} --bucket "{}"'.format(edition, bucket),
        ],
    }

def store_storybook_step(edition, ver_mode):
    if edition in ('enterprise', 'enterprise2'):
        return None


    commands = []
    if ver_mode == 'release':
        channels = ['latest', '${DRONE_TAG}', ]
    else:
        channels = ['canary', ]
    commands.extend([
                        'printenv GCP_KEY | base64 -d > /tmp/gcpkey.json',
                        'gcloud auth activate-service-account --key-file=/tmp/gcpkey.json',
                    ] + [
                        'gsutil -m rsync -d -r ./packages/grafana-ui/dist/storybook gs://$${{PRERELEASE_BUCKET}}/artifacts/storybook/{}'.format(
                            c)
                        for c in channels
                    ])

    return {
        'name': 'store-storybook',
        'image': publish_image,
        'depends_on': ['build-storybook',] + end_to_end_tests_deps(edition),
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
            'PRERELEASE_BUCKET': from_secret(prerelease_bucket)
        },
        'commands': commands,
    }

def copy_packages_for_docker_step():
    return {
        'name': 'copy-packages-for-docker',
        'image': build_image,
        'depends_on': [
            'package',
        ],
        'commands': [
            'ls dist/*.tar.gz*',
            'cp dist/*.tar.gz* packaging/docker/',
        ],
    }

