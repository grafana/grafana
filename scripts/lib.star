load('scripts/vault.star', 'from_secret', 'github_token', 'pull_secret', 'drone_token')

grabpl_version = '2.2.8'
build_image = 'grafana/build-container:1.4.1'
publish_image = 'grafana/grafana-ci-deploy:1.3.1'
grafana_docker_image = 'grafana/drone-grafana-docker:0.3.2'
deploy_docker_image = 'us.gcr.io/kubernetes-dev/drone/plugins/deploy-image'
alpine_image = 'alpine:3.13'
windows_image = 'mcr.microsoft.com/windows:1809'
dockerize_version = '0.6.1'
wix_image = 'grafana/ci-wix:0.1.1'
test_release_ver = 'v7.3.0-test'

def pipeline(
    name, edition, trigger, steps, ver_mode, services=[], platform='linux', depends_on=[],
    is_downstream=False, install_deps=True,
    ):
    if platform != 'windows':
        platform_conf = {
            'os': 'linux',
            'arch': 'amd64',
        }
    else:
        platform_conf = {
            'os': 'windows',
            'arch': 'amd64',
            'version': '1809',
        }

    pipeline = {
        'kind': 'pipeline',
        'type': 'docker',
        'platform': platform_conf,
        'name': name,
        'trigger': trigger,
        'services': services,
        'steps': init_steps(
            edition, platform, is_downstream=is_downstream, install_deps=install_deps, ver_mode=ver_mode,
        ) + steps,
        'depends_on': depends_on,
    }

    if edition in ('enterprise', 'enterprise2'):
        pipeline['image_pull_secrets'] = [pull_secret]
        # We have a custom clone step for enterprise
        pipeline['clone'] = {
            'disable': True,
        }

    return pipeline

def notify_pipeline(name, slack_channel, trigger, depends_on=[]):
    trigger = dict(trigger, status = ['failure'])
    return {
        'kind': 'pipeline',
        'type': 'docker',
        'platform': {
            'os': 'linux',
            'arch': 'amd64',
        },
        'name': name,
        'trigger': trigger,
        'steps': [
            slack_step(slack_channel),
        ],
        'depends_on': depends_on,
    }

def slack_step(channel):
    return {
        'name': 'slack',
        'image': 'plugins/slack',
        'settings': {
            'webhook': from_secret('slack_webhook'),
            'channel': channel,
            'template': 'Build {{build.number}} failed for commit: <https://github.com/{{repo.owner}}/{{repo.name}}/commit/{{build.commit}}|{{ truncate build.commit 8 }}>: {{build.link}}\nBranch: <https://github.com/{{ repo.owner }}/{{ repo.name }}/commits/{{ build.branch }}|{{ build.branch }}>\nAuthor: {{build.author}}',
        },
    }

def init_steps(edition, platform, ver_mode, is_downstream=False, install_deps=True):
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

    download_grabpl_cmds = [
        'mkdir -p bin',
        'curl -fL -o bin/grabpl https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v{}/grabpl'.format(
            grabpl_version
        ),
        'chmod +x bin/grabpl',
    ]
    common_cmds = [
        './bin/grabpl verify-drone',
    ]

    if ver_mode == 'release':
        common_cmds.append('./bin/grabpl verify-version ${DRONE_TAG}')
    elif ver_mode == 'test-release':
        common_cmds.append('./bin/grabpl verify-version {}'.format(test_release_ver))

    identify_runner_step = {
        'name': 'identify-runner',
        'image': alpine_image,
        'commands': [
            'echo $DRONE_RUNNER_NAME',
        ],
    }

    if install_deps:
        common_cmds.extend([
            'curl -fLO https://github.com/jwilder/dockerize/releases/download/v$${DOCKERIZE_VERSION}/dockerize-linux-amd64-v$${DOCKERIZE_VERSION}.tar.gz',
            'tar -C bin -xzvf dockerize-linux-amd64-v$${DOCKERIZE_VERSION}.tar.gz',
            'rm dockerize-linux-amd64-v$${DOCKERIZE_VERSION}.tar.gz',
            'yarn install --frozen-lockfile --no-progress',
        ])
    if edition in ('enterprise', 'enterprise2'):
        source_commit = ''
        if ver_mode == 'release':
            committish = '${DRONE_TAG}'
            source_commit = ' ${DRONE_TAG}'
        elif ver_mode == 'test-release':
            committish = 'main'
        elif ver_mode == 'release-branch':
            committish = '${DRONE_BRANCH}'
        else:
            if is_downstream:
                source_commit = ' $${SOURCE_COMMIT}'
            committish = '${DRONE_COMMIT}'
        steps = [
            identify_runner_step,
            {
                'name': 'clone',
                'image': build_image,
                'environment': {
                    'GITHUB_TOKEN': from_secret(github_token),
                },
                'commands': download_grabpl_cmds + [
                    'git clone "https://$${GITHUB_TOKEN}@github.com/grafana/grafana-enterprise.git"',
                    'cd grafana-enterprise',
                    'git checkout {}'.format(committish),
                ],
            },
            {
                'name': 'initialize',
                'image': build_image,
                'environment': {
                    'DOCKERIZE_VERSION': dockerize_version,
                },
                'depends_on': [
                    'clone',
                ],
                'commands': [
                    'mv bin/grabpl /tmp/',
                    'rmdir bin',
                    'mv grafana-enterprise /tmp/',
                    '/tmp/grabpl init-enterprise /tmp/grafana-enterprise{}'.format(source_commit),
                    'mv /tmp/grafana-enterprise/deployment_tools_config.json deployment_tools_config.json',
                    'mkdir bin',
                    'mv /tmp/grabpl bin/'
                ] + common_cmds,
            },
        ]

        return steps

    steps = [
        identify_runner_step,
        {
            'name': 'initialize',
            'image': build_image,
            'environment': {
                'DOCKERIZE_VERSION': dockerize_version,
            },
            'commands': download_grabpl_cmds + common_cmds,
        },
    ]

    return steps

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

def lint_backend_step(edition):
    return {
        'name': 'lint-backend' + enterprise2_sfx(edition),
        'image': build_image,
        'environment': {
            # We need CGO because of go-sqlite3
            'CGO_ENABLED': '1',
        },
        'depends_on': [
            'initialize',
            'test-backend' + enterprise2_sfx(edition),
        ],
        'commands': [
            # Don't use Make since it will re-download the linters
            './bin/grabpl lint-backend --edition {}'.format(edition),
        ],
    }

def benchmark_ldap_step():
    return {
        'name': 'benchmark-ldap',
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'environment': {
	  'LDAP_HOSTNAME': 'ldap',
        },
        'commands': [
            './bin/dockerize -wait tcp://ldap:389 -timeout 120s',
            'go test -benchmem -run=^$ ./pkg/extensions/ldapsync -bench "^(Benchmark50Users)$"',
        ],
    }

def ldap_service():
    return {
        'name': 'ldap',
        'image': 'osixia/openldap:1.4.0',
        'environment': {
          'LDAP_ADMIN_PASSWORD': 'grafana',
          'LDAP_DOMAIN': 'grafana.org',
          'SLAPD_ADDITIONAL_MODULES': 'memberof',
        },
    }

def build_storybook_step(edition, ver_mode):
    if edition in ('enterprise', 'enterprise2') and ver_mode in ('release', 'test-release'):
        return None

    return {
        'name': 'build-storybook',
        'image': build_image,
        'depends_on': [
            # Best to ensure that this step doesn't mess with what's getting built and packaged
            'package',
        ],
        'environment': {
            'NODE_OPTIONS': '--max_old_space_size=4096',
        },
        'commands': [
            'yarn storybook:build',
            './bin/grabpl verify-storybook',
        ],
    }

def publish_storybook_step(edition, ver_mode):
    if edition in ('enterprise', 'enterprise2'):
        return None

    if ver_mode == 'test-release':
        commands = [
            'echo Testing release',
        ]
    else:
        commands = []
        if ver_mode == 'release':
            channels = ['latest', '${DRONE_TAG}',]
        else:
            channels = ['canary',]
        commands.extend([
            'printenv GCP_KEY | base64 -d > /tmp/gcpkey.json',
            'gcloud auth activate-service-account --key-file=/tmp/gcpkey.json',
        ] + [
            'gsutil -m rsync -d -r ./packages/grafana-ui/dist/storybook gs://grafana-storybook/{}'.format(c)
            for c in channels
        ])

    return {
        'name': 'publish-storybook',
        'image': publish_image,
        'depends_on': [
            'build-storybook',
            'end-to-end-tests',
        ],
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
        },
        'commands': commands,
    }

def upload_cdn(edition):
    return {
        'name': 'upload-cdn-assets' + enterprise2_sfx(edition),
        'image': publish_image,
        'depends_on': [
            'package' + enterprise2_sfx(edition),
        ],
        'environment': {
            'GCP_GRAFANA_UPLOAD_KEY': from_secret('gcp_key'),
        },
        'commands': [
             './bin/grabpl upload-cdn --edition {} --bucket "grafana-static-assets"'.format(edition),
        ],
    }

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
        'name': 'build-backend' + enterprise2_sfx(edition),
        'image': build_image,
        'depends_on': [
            'initialize',
            'lint-backend' + enterprise2_sfx(edition),
            'test-backend' + enterprise2_sfx(edition),
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
            'test-frontend',
        ],
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
            'lint-backend',
        ],
        'environment': env,
        'commands': [
            # TODO: Use percentage for num jobs
            './bin/grabpl build-plugins --jobs 8 --edition {} --no-install-deps{}'.format(edition, sign_args),
        ],
    }

def test_backend_step(edition, tries=None):
    test_backend_cmd = './bin/grabpl test-backend --edition {}'.format(edition)
    integration_tests_cmd = './bin/grabpl integration-tests --edition {}'.format(edition)
    if tries:
        test_backend_cmd += ' --tries {}'.format(tries)
        integration_tests_cmd += ' --tries {}'.format(tries)
    return {
        'name': 'test-backend' + enterprise2_sfx(edition),
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'commands': [
            # First make sure that there are no tests with FocusConvey
            '[ $(grep FocusConvey -R pkg | wc -l) -eq "0" ] || exit 1',
            # Then execute non-integration tests in parallel, since it should be safe
            test_backend_cmd,
            # Then execute integration tests in serial
            integration_tests_cmd,
        ],
    }

def test_frontend_step():
    return {
        'name': 'test-frontend',
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'environment': {
            'TEST_MAX_WORKERS': '50%',
        },
        'commands': [
            'yarn run ci:test-frontend',
        ],
    }

def frontend_metrics_step(edition):
    if edition in ('enterprise', 'enterprise2'):
        return None

    return {
        'name': 'publish-frontend-metrics',
        'image': build_image,
        'depends_on': [
            'build-frontend',
        ],
        'environment': {
            'GRAFANA_MISC_STATS_API_KEY': from_secret('grafana_misc_stats_api_key'),
        },
        'failure': 'ignore',
        'commands': [
            './scripts/ci-frontend-metrics.sh | ./bin/grabpl publish-metrics $${GRAFANA_MISC_STATS_API_KEY}',
        ],
    }


def codespell_step():
    return {
        'name': 'codespell',
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'commands': [
            # Important: all words have to be in lowercase, and separated by "\n".
            'echo -e "unknwon\nreferer\nerrorstring\neror\niam\nwan" > words_to_ignore.txt',
            'codespell -I words_to_ignore.txt docs/',
        ],
    }

def shellcheck_step():
    return {
        'name': 'shellcheck',
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'commands': [
            './bin/grabpl shellcheck',
        ],
    }

def gen_version_step(ver_mode, include_enterprise2=False, is_downstream=False):
    deps = [
        'build-backend',
        'build-frontend',
        'build-plugins',
        'test-backend',
        'test-frontend',
        'codespell',
        'shellcheck',
    ]
    if include_enterprise2:
        sfx = '-enterprise2'
        deps.extend([
            'build-backend' + sfx,
            'test-backend' + sfx,
        ])

    if ver_mode == 'release':
        args = '${DRONE_TAG}'
    elif ver_mode == 'test-release':
        args = test_release_ver
    else:
        if not is_downstream:
            build_no = '${DRONE_BUILD_NUMBER}'
        else:
            build_no = '$${SOURCE_BUILD_NUMBER}'
        args = '--build-id {}'.format(build_no)

    return {
        'name': 'gen-version',
        'image': build_image,
        'depends_on': deps,
        'commands': [
            './bin/grabpl gen-version {}'.format(args),
        ],
    }


def package_step(edition, ver_mode, variants=None, is_downstream=False):
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
        'name': 'package' + enterprise2_sfx(edition),
        'image': build_image,
        'depends_on': [
            # This step should have all the dependencies required for packaging, and should generate
            # dist/grafana.version
            'gen-version',
        ],
        'environment': env,
        'commands': cmds,
    }

def e2e_tests_server_step(edition, port=3001):
    package_file_pfx = ''
    if edition == 'enterprise2':
        package_file_pfx = 'grafana' + enterprise2_sfx(edition)
    elif edition == 'enterprise':
        package_file_pfx = 'grafana-' + edition

    environment = {
        'PORT': port,
    }
    if package_file_pfx:
        environment['PACKAGE_FILE'] = 'dist/{}-*linux-amd64.tar.gz'.format(package_file_pfx)
        environment['RUNDIR'] = 'e2e/tmp-{}'.format(package_file_pfx)

    return {
        'name': 'end-to-end-tests-server' + enterprise2_sfx(edition),
        'image': build_image,
        'detach': True,
        'depends_on': [
            'package' + enterprise2_sfx(edition),
        ],
        'environment': environment,
        'commands': [
            './e2e/start-server',
        ],
    }

def e2e_tests_step(edition, port=3001, tries=None):
    cmd = './bin/grabpl e2e-tests --port {}'.format(port)
    if tries:
        cmd += ' --tries {}'.format(tries)
    return {
        'name': 'end-to-end-tests' + enterprise2_sfx(edition),
        'image': 'grafana/ci-e2e:12.19.0-1',
        'depends_on': [
            'end-to-end-tests-server' + enterprise2_sfx(edition),
        ],
        'environment': {
            'HOST': 'end-to-end-tests-server' + enterprise2_sfx(edition),
        },
        'commands': [
            # Have to re-install Cypress since it insists on searching for its binary beneath /root/.cache,
            # even though the Yarn cache directory is beneath /usr/local/share somewhere
            './node_modules/.bin/cypress install',
            cmd,
        ],
    }

def build_docs_website_step():
    return {
        'name': 'build-docs-website',
        # Use latest revision here, since we want to catch if it breaks
        'image': 'grafana/docs-base:latest',
        'depends_on': [
            'initialize',
            'build-frontend-docs',
        ],
        'commands': [
            'mkdir -p /hugo/content/docs/grafana',
            'cp -r docs/sources/* /hugo/content/docs/grafana/latest/',
            'cd /hugo && make prod',
        ],
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

def postgres_integration_tests_step():
    return {
        'name': 'postgres-integration-tests',
        'image': build_image,
        'depends_on': [
            'test-backend',
            'test-frontend',
        ],
        'environment': {
            'PGPASSWORD': 'grafanatest',
            'GRAFANA_TEST_DB': 'postgres',
            'POSTGRES_HOST': 'postgres',
        },
        'commands': [
            'apt-get update',
            'apt-get install -yq postgresql-client',
            './bin/dockerize -wait tcp://postgres:5432 -timeout 120s',
            'psql -p 5432 -h postgres -U grafanatest -d grafanatest -f ' +
                'devenv/docker/blocks/postgres_tests/setup.sql',
            # Make sure that we don't use cached results for another database
            'go clean -testcache',
            './bin/grabpl integration-tests --database postgres',
        ],
    }

def mysql_integration_tests_step():
    return {
        'name': 'mysql-integration-tests',
        'image': build_image,
        'depends_on': [
            'test-backend',
            'test-frontend',
        ],
        'environment': {
            'GRAFANA_TEST_DB': 'mysql',
            'MYSQL_HOST': 'mysql',
        },
        'commands': [
            'apt-get update',
            'apt-get install -yq default-mysql-client',
            './bin/dockerize -wait tcp://mysql:3306 -timeout 120s',
            'cat devenv/docker/blocks/mysql_tests/setup.sql | mysql -h mysql -P 3306 -u root -prootpass',
            # Make sure that we don't use cached results for another database
            'go clean -testcache',
            './bin/grabpl integration-tests --database mysql',
        ],
    }

def redis_integration_tests_step():
    return {
        'name': 'redis-integration-tests',
        'image': build_image,
        'depends_on': [
            'test-backend',
            'test-frontend',
        ],
        'environment': {
            'REDIS_URL': 'redis://redis:6379/0',
        },
        'commands': [
            './bin/dockerize -wait tcp://redis:6379/0 -timeout 120s',
            './bin/grabpl integration-tests',
        ],
    }

def memcached_integration_tests_step():
    return {
        'name': 'memcached-integration-tests',
        'image': build_image,
        'depends_on': [
            'test-backend',
            'test-frontend',
        ],
        'environment': {
            'MEMCACHED_HOSTS': 'memcached:11211',
        },
        'commands': [
            './bin/dockerize -wait tcp://memcached:11211 -timeout 120s',
            './bin/grabpl integration-tests',
        ],
    }

def release_canary_npm_packages_step(edition):
    if edition in ('enterprise', 'enterprise2'):
        return None

    return {
        'name': 'release-canary-npm-packages',
        'image': build_image,
        'depends_on': [
            'end-to-end-tests',
        ],
        'environment': {
            'GITHUB_PACKAGE_TOKEN': from_secret('github_package_token'),
        },
        'commands': [
            './scripts/circle-release-canary-packages.sh',
        ],
    }

def push_to_deployment_tools_step(edition, is_downstream=False):
    if edition != 'enterprise' or not is_downstream:
        return None

    return {
        'name': 'push-to-deployment_tools',
        'image': deploy_docker_image,
        'depends_on': [
            'build-docker-images',
            # This step should have all the dependencies required for packaging, and should generate
            # dist/grafana.version
            'gen-version',
        ],
        'settings': {
            'github_token': from_secret(github_token),
            'images_file': './deployment_tools_config.json',
            'docker_tag_file': './dist/grafana.version'
        },
    }

def enterprise2_sfx(edition):
    if edition == 'enterprise2':
        return '-{}'.format(edition)
    return ''

def upload_packages_step(edition, ver_mode, is_downstream=False):
    if ver_mode == 'main' and edition in ('enterprise', 'enterprise2') and not is_downstream:
        return None

    packages_bucket = ' --packages-bucket grafana-downloads' + enterprise2_sfx(edition)

    if ver_mode == 'test-release':
        cmd = './bin/grabpl upload-packages --edition {} '.format(edition) + \
            '--packages-bucket grafana-downloads-test'
    else:
        cmd = './bin/grabpl upload-packages --edition {}{}'.format(edition, packages_bucket)

    dependencies = [
        'package' + enterprise2_sfx(edition),
        'end-to-end-tests' + enterprise2_sfx(edition),
        'mysql-integration-tests',
        'postgres-integration-tests',
    ]

    if edition in ('enterprise', 'enterprise2'):
      dependencies.append('redis-integration-tests')
      dependencies.append('memcached-integration-tests')

    return {
        'name': 'upload-packages' + enterprise2_sfx(edition),
        'image': publish_image,
        'depends_on': dependencies,
        'environment': {
            'GCP_GRAFANA_UPLOAD_KEY': from_secret('gcp_key'),
        },
        'commands': [cmd,],
    }

def publish_packages_step(edition, ver_mode, is_downstream=False):
    if ver_mode == 'test-release':
        cmd = './bin/grabpl publish-packages --edition {} --gcp-key /tmp/gcpkey.json '.format(edition) + \
            '--deb-db-bucket grafana-testing-aptly-db --deb-repo-bucket grafana-testing-repo --packages-bucket ' + \
            'grafana-downloads-test --rpm-repo-bucket grafana-testing-repo --simulate-release {}'.format(
                test_release_ver,
            )
    elif ver_mode == 'release':
        cmd = './bin/grabpl publish-packages --edition {} --gcp-key /tmp/gcpkey.json ${{DRONE_TAG}}'.format(
            edition,
        )
    elif ver_mode == 'main':
        if not is_downstream:
            build_no = '${DRONE_BUILD_NUMBER}'
        else:
            build_no = '$${SOURCE_BUILD_NUMBER}'
        cmd = './bin/grabpl publish-packages --edition {} --gcp-key /tmp/gcpkey.json --build-id {}'.format(
                edition, build_no,
        )
    else:
        fail('Unexpected version mode {}'.format(ver_mode))

    return {
        'name': 'publish-packages-{}'.format(edition),
        'image': publish_image,
        'depends_on': [
            'initialize',
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

def get_windows_steps(edition, ver_mode, is_downstream=False):
    if not is_downstream:
        source_commit = ''
    else:
        source_commit = ' $$env:SOURCE_COMMIT'

    init_cmds = []
    sfx = ''
    if edition in ('enterprise', 'enterprise2'):
        sfx = '-{}'.format(edition)
    else:
        init_cmds.extend([
            '$$ProgressPreference = "SilentlyContinue"',
            'Invoke-WebRequest https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v{}/windows/grabpl.exe -OutFile grabpl.exe'.format(grabpl_version),
        ])
    steps = [
        {
            'name': 'initialize',
            'image': wix_image,
            'commands': init_cmds,
        },
    ]
    if (ver_mode == 'main' and (edition not in ('enterprise', 'enterprise2') or is_downstream)) or ver_mode in (
        'release', 'test-release', 'release-branch',
    ):
        bucket_part = ''
        bucket = 'grafana-downloads'
        if ver_mode == 'release':
            ver_part = '${DRONE_TAG}'
            dir = 'release'
        elif ver_mode == 'test-release':
            ver_part = test_release_ver
            dir = 'release'
            bucket = 'grafana-downloads-test'
            bucket_part = ' --packages-bucket {}'.format(bucket)
        else:
            dir = 'main'
            if not is_downstream:
                build_no = 'DRONE_BUILD_NUMBER'
            else:
                build_no = 'SOURCE_BUILD_NUMBER'
            ver_part = '--build-id $$env:{}'.format(build_no)
        installer_commands = [
            '$$gcpKey = $$env:GCP_KEY',
            '[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($$gcpKey)) > gcpkey.json',
            # gcloud fails to read the file unless converted with dos2unix
            'dos2unix gcpkey.json',
            'gcloud auth activate-service-account --key-file=gcpkey.json',
            'rm gcpkey.json',
            'cp C:\\App\\nssm-2.24.zip .',
        ]
        if (ver_mode == 'main' and (edition not in ('enterprise', 'enterprise2') or is_downstream)) or ver_mode in (
            'release', 'test-release',
        ):
            installer_commands.extend([
                '.\\grabpl.exe windows-installer --edition {}{} {}'.format(edition, bucket_part, ver_part),
                '$$fname = ((Get-Childitem grafana*.msi -name) -split "`n")[0]',
                'gsutil cp $$fname gs://{}/{}/{}/'.format(bucket, edition, dir),
                'gsutil cp "$$fname.sha256" gs://{}/{}/{}/'.format(bucket, edition, dir),
            ])
        steps.append({
            'name': 'build-windows-installer',
            'image': wix_image,
            'environment': {
                'GCP_KEY': from_secret('gcp_key'),
            },
            'commands': installer_commands,
            'depends_on': [
                'initialize',
            ],
        })

    if edition in ('enterprise', 'enterprise2'):
        if ver_mode == 'release':
            committish = '${DRONE_TAG}'
        elif ver_mode == 'test-release':
            committish = 'main'
        elif ver_mode == 'release-branch':
            committish = '$$env:DRONE_BRANCH'
        else:
            committish = '$$env:DRONE_COMMIT'
        # For enterprise, we have to clone both OSS and enterprise and merge the latter into the former
        download_grabpl_cmds = [
            '$$ProgressPreference = "SilentlyContinue"',
            'Invoke-WebRequest https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v{}/windows/grabpl.exe -OutFile grabpl.exe'.format(grabpl_version),
        ]
        clone_cmds = [
            'git clone "https://$$env:GITHUB_TOKEN@github.com/grafana/grafana-enterprise.git"',
        ]
        if not is_downstream:
            clone_cmds.extend([
                'cd grafana-enterprise',
                'git checkout {}'.format(committish),
            ])
        steps.insert(0, {
            'name': 'clone',
            'image': wix_image,
            'environment': {
                'GITHUB_TOKEN': from_secret(github_token),
            },
            'commands': download_grabpl_cmds + clone_cmds,
        })
        steps[1]['depends_on'] = [
            'clone',
        ]
        steps[1]['commands'].extend([
            # Need to move grafana-enterprise out of the way, so directory is empty and can be cloned into
            'cp -r grafana-enterprise C:\\App\\grafana-enterprise',
            'rm -r -force grafana-enterprise',
            'cp grabpl.exe C:\\App\\grabpl.exe',
            'rm -force grabpl.exe',
            'C:\\App\\grabpl.exe init-enterprise C:\\App\\grafana-enterprise{}'.format(source_commit),
            'cp C:\\App\\grabpl.exe grabpl.exe',
        ])

    return steps

def integration_test_services(edition):
    services = [
        {
            'name': 'postgres',
            'image': 'postgres:12.3-alpine',
            'environment': {
              'POSTGRES_USER': 'grafanatest',
              'POSTGRES_PASSWORD': 'grafanatest',
              'POSTGRES_DB': 'grafanatest',
            },
        },
        {
            'name': 'mysql',
            'image': 'mysql:5.6.48',
            'environment': {
                'MYSQL_ROOT_PASSWORD': 'rootpass',
                'MYSQL_DATABASE': 'grafana_tests',
                'MYSQL_USER': 'grafana',
                'MYSQL_PASSWORD': 'password',
            },
        },
    ]

    if edition in ('enterprise', 'enterprise2'):
        services.extend([{
            'name': 'redis',
            'image': 'redis:6.2.1-alpine',
            'environment': {},
        }, {
            'name': 'memcached',
            'image': 'memcached:1.6.9-alpine',
            'environment': {},
        }])

    return services

def validate_scuemata():
    return {
        'name': 'validate-scuemata',
        'image': build_image,
        'depends_on': [
            'build-backend',
        ],
        'commands': [
            './bin/linux-amd64/grafana-cli cue validate-schema',
        ],
    }
