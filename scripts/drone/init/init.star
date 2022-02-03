load('scripts/drone/vault.star', 'from_secret', 'github_token', 'pull_secret', 'drone_token', 'prerelease_bucket')
load('scripts/drone/utils/var.star', 'grabpl_version', 'build_image', 'publish_image', 'grafana_docker_image', 'deploy_docker_image', 'alpine_image', 'curl_image', 'windows_image', 'wix_image', 'disable_tests')

def slack_step(channel, template, secret):
    return {
        'name': 'slack',
        'image': 'plugins/slack',
        'settings': {
            'webhook': from_secret(secret),
            'channel': channel,
            'template': template,
        },
    }


def initialize_step(edition, platform, ver_mode, is_downstream=False, install_deps=True):
    if platform == 'windows':
        return [
            {
                'name': 'identify-runner',
                'image': windows_image,
                'commands': [
                    'echo $env:DRONE_RUNNER_NAME',
                ],
            },
        ]

    common_cmds = [
        # Generate Go code, will install Wire
        # TODO: Install Wire in Docker image instead
        'make gen-go',
    ]

    if ver_mode == 'release':
        args = '${DRONE_TAG}'
        common_cmds.append('./bin/grabpl verify-version ${DRONE_TAG}')
    else:
        if not is_downstream:
            build_no = '${DRONE_BUILD_NUMBER}'
        else:
            build_no = '$${SOURCE_BUILD_NUMBER}'
        args = '--build-id {}'.format(build_no)

    identify_runner = identify_runner_step(platform)

    if install_deps:
        common_cmds.extend([
            './bin/grabpl gen-version {}'.format(args),
            'yarn install --immutable',
        ])
    if edition in ('enterprise', 'enterprise2'):
        source_commit = ''
        if ver_mode == 'release':
            committish = '${DRONE_TAG}'
            source_commit = ' ${DRONE_TAG}'
        elif ver_mode == 'release-branch':
            committish = '${DRONE_BRANCH}'
        else:
            if is_downstream:
                source_commit = ' $${SOURCE_COMMIT}'
            committish = '${DRONE_COMMIT}'
        steps = [
            identify_runner,
            clone_enterprise(committish),
            {
                'name': 'initialize',
                'image': build_image,
                'depends_on': [
                    'clone-enterprise',
                ],
                'environment': {
                  'GITHUB_TOKEN': from_secret(github_token),
                },
                'commands': [
                                'mv bin/grabpl /tmp/',
                                'rmdir bin',
                                'mv grafana-enterprise /tmp/',
                                '/tmp/grabpl init-enterprise --github-token $${{GITHUB_TOKEN}} /tmp/grafana-enterprise{}'.format(source_commit),
                                'mv /tmp/grafana-enterprise/deployment_tools_config.json deployment_tools_config.json',
                                'mkdir bin',
                                'mv /tmp/grabpl bin/'
                            ] + common_cmds,
            },
        ]

        return steps

    steps = [
        identify_runner,
        {
            'name': 'initialize',
            'image': build_image,
            'commands': common_cmds,
        },
    ]

    return steps


def identify_runner_step(platform):
    if platform == 'linux':
        return {
            'name': 'identify-runner',
            'image': alpine_image,
            'commands': [
                'echo $DRONE_RUNNER_NAME',
            ],
        }
    else:
        return {
            'name': 'identify-runner',
            'image': windows_image,
            'commands': [
                'echo $env:DRONE_RUNNER_NAME',
            ],
        }


def clone_enterprise(committish):
    return {
        'name': 'clone-enterprise',
        'image': build_image,
        'environment': {
            'GITHUB_TOKEN': from_secret(github_token),
        },
        'commands': [
            'git clone "https://$${GITHUB_TOKEN}@github.com/grafana/grafana-enterprise.git"',
            'cd grafana-enterprise',
            'git checkout {}'.format(committish),
        ],
    }


def download_grabpl_step():
    return {
        'name': 'grabpl',
        'image': curl_image,
        'commands': [
            'mkdir -p bin',
            'curl -fL -o bin/grabpl https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/{}/grabpl'.format(
                grabpl_version
            ),
            'chmod +x bin/grabpl',
        ]
    }


def enterprise_downstream_step(edition):
    if edition in ('enterprise', 'enterprise2'):
        return None

    return {
        'name': 'trigger-enterprise-downstream',
        'image': 'grafana/drone-downstream',
        'settings': {
            'server': 'https://drone.grafana.net',
            'token': from_secret(drone_token),
            'repositories': [
                'grafana/grafana-enterprise@main',
            ],
            'params': [
                'SOURCE_BUILD_NUMBER=${DRONE_BUILD_NUMBER}',
                'SOURCE_COMMIT=${DRONE_COMMIT}',
            ],
        },
    }


def enterprise2_suffix(edition):
    if edition == 'enterprise2':
        return '-{}'.format(edition)
    return ''


def end_to_end_tests_deps(edition):
    if disable_tests:
        return []
    return [
        'end-to-end-tests-dashboards-suite' + enterprise2_suffix(edition),
        'end-to-end-tests-panels-suite' + enterprise2_suffix(edition),
        'end-to-end-tests-smoke-tests-suite' + enterprise2_suffix(edition),
        'end-to-end-tests-various-suite' + enterprise2_suffix(edition),
    ]
