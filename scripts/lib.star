build_image = 'grafana/build-container:1.2.27'
publish_image = 'grafana/grafana-ci-deploy:1.2.6'
grafana_docker_image = 'grafana/drone-grafana-docker:0.3.2'
alpine_image = 'alpine:3.12'
windows_image = 'mcr.microsoft.com/windows:1809'
grabpl_version = '0.5.16'
git_image = 'alpine/git:v2.26.2'
dockerize_version = '0.6.1'
wix_image = 'grafana/ci-wix:0.1.1'

def pr_pipelines(edition):
    version_mode = 'pr'
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
    variants = ['linux-x64', 'linux-x64-musl', 'osx64', 'win64',]
    steps = [
        lint_backend_step(edition),
        codespell_step(),
        shellcheck_step(),
        test_backend_step(),
        test_frontend_step(),
        build_backend_step(edition=edition, variants=variants),
        build_frontend_step(edition=edition),
        build_plugins_step(edition=edition),
        package_step(edition=edition, variants=variants),
        e2e_tests_server_step(),
        e2e_tests_step(),
        build_storybook_step(edition),
        build_docs_website_step(),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition=edition, archs=['amd64',]),
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
    ]
    windows_steps = get_windows_steps(edition=edition, version_mode=version_mode)
    if edition == 'enterprise':
        steps.append(benchmark_ldap_step())
        services.append(ldap_service())
    trigger = {
        'event': ['pull_request',],
    }
    return [
        pipeline(
            name='test-pr', edition=edition, trigger=trigger, services=services, steps=steps,
            version_mode=version_mode,
        ),
        pipeline(
            name='windows-pr', edition=edition, trigger=trigger, steps=windows_steps, platform='windows',
            version_mode=version_mode,
        ),
    ]

def master_steps(edition, is_downstream=False):
    publish = edition != 'enterprise' or is_downstream
    steps = [
        enterprise_downstream_step(edition),
        lint_backend_step(edition),
        codespell_step(),
        shellcheck_step(),
        test_backend_step(),
        test_frontend_step(),
        frontend_metrics_step(edition=edition),
        build_backend_step(edition=edition, is_downstream=is_downstream),
        build_frontend_step(edition=edition, is_downstream=is_downstream),
        build_plugins_step(edition=edition, sign=True),
        package_step(edition=edition, sign=True, is_downstream=is_downstream),
        e2e_tests_server_step(),
        e2e_tests_step(),
        build_storybook_step(edition=edition),
        publish_storybook_step(edition=edition),
        build_docs_website_step(),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition=edition, publish=publish),
        build_docker_images_step(edition=edition, ubuntu=True, publish=publish),
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
        release_next_npm_packages_step(edition),
        upload_packages_step(edition, is_downstream),
        deploy_to_kubernetes_step(edition, is_downstream),
    ]
    windows_steps = get_windows_steps(edition=edition, version_mode='master', is_downstream=is_downstream)

    publish_steps = [
        publish_packages_step(edition, is_downstream),
    ]

    return steps, windows_steps, publish_steps

def master_pipelines(edition):
    version_mode = 'master'
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
    trigger = {
        'event': ['push',],
        'branch': 'master',
    }
    steps, windows_steps, publish_steps = master_steps(edition=edition)

    if edition == 'enterprise':
        steps.append(benchmark_ldap_step())
        services.append(ldap_service())

    pipelines = [
        pipeline(
            name='build-master', edition=edition, trigger=trigger, services=services, steps=steps,
            version_mode=version_mode,
        ),
        pipeline(
            name='windows-master', edition=edition, trigger=trigger, steps=windows_steps, platform='windows',
            depends_on=['build-master'], version_mode=version_mode,
        ),
    ]
    if edition != 'enterprise':
        pipelines.append(pipeline(
            name='publish-master', edition=edition, trigger=trigger, steps=publish_steps,
            depends_on=['build-master', 'windows-master',], install_deps=False, version_mode=version_mode,
        ))

        notify_trigger = dict(trigger, status = ['failure'])
        pipelines.append(notify_pipeline(
            name='notify-master', slack_channel='grafana-ci-notifications', trigger=notify_trigger,
            depends_on=['build-master', 'windows-master', 'publish-master'],
        ))
    if edition == 'enterprise':
        # Add downstream enterprise pipelines triggerable from OSS builds
        trigger = {
            'event': ['custom',],
        }
        steps, windows_steps, publish_steps = master_steps(edition=edition, is_downstream=True)
        pipelines.append(pipeline(
            name='build-master-downstream', edition=edition, trigger=trigger, services=services, steps=steps,
            is_downstream=True, version_mode=version_mode,
        ))
        pipelines.append(pipeline(
            name='windows-master-downstream', edition=edition, trigger=trigger, steps=windows_steps,
            platform='windows', depends_on=['build-master-downstream'], is_downstream=True, version_mode=version_mode,
        ))
        pipelines.append(pipeline(
            name='publish-master-downstream', edition=edition, trigger=trigger, steps=publish_steps,
            depends_on=['build-master-downstream', 'windows-master-downstream'], is_downstream=True, install_deps=False,
            version_mode=version_mode,
        ))

        notify_trigger = dict(trigger, status = ['failure'])
        pipelines.append(notify_pipeline(
            name='notify-master-downstream', slack_channel='grafana-enterprise-ci-notifications', trigger=notify_trigger,
            depends_on=['build-master-downstream', 'windows-master-downstream', 'publish-master-downstream'],
        ))

    return pipelines

def pipeline(
    name, edition, trigger, steps, version_mode, services=[], platform='linux', depends_on=[],
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
            edition, platform, is_downstream=is_downstream, install_deps=install_deps, version_mode=version_mode,
        ) + steps,
        'depends_on': depends_on,
    }

    if edition == 'enterprise':
        # We have a custom clone step for enterprise
        pipeline['clone'] = {
            'disable': True,
        }

    return pipeline

def notify_pipeline(name, slack_channel, trigger, depends_on=[]):
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
            'webhook': {
                'from_secret': 'slack_webhook',
            },
            'channel': channel,
            'template': 'Build {{build.number}} failed: {{build.link}}',
        },
    }

def init_steps(edition, platform, version_mode, is_downstream=False, install_deps=True):
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

    identify_runner_step = {
        'name': 'identify-runner',
        'image': alpine_image,
        'commands': [
            'echo $DRONE_RUNNER_NAME',
        ],
    }

    if install_deps:
        common_cmds = [
            'curl -fLO https://github.com/jwilder/dockerize/releases/download/v$${DOCKERIZE_VERSION}/dockerize-linux-amd64-v$${DOCKERIZE_VERSION}.tar.gz',
            'tar -C bin -xzvf dockerize-linux-amd64-v$${DOCKERIZE_VERSION}.tar.gz',
            'rm dockerize-linux-amd64-v$${DOCKERIZE_VERSION}.tar.gz',
            'yarn install --frozen-lockfile --no-progress',
        ]
    else:
        common_cmds = []
    if edition == 'enterprise':
        if is_downstream:
            source_commit = ' $${SOURCE_COMMIT}'
        else:
            source_commit = ''
        steps = [
            identify_runner_step,
            {
                'name': 'clone',
                'image': git_image,
                'environment': {
                    'GITHUB_TOKEN': {
                        'from_secret': 'github_token',
                    },
                },
                'commands': [
                    'git clone "https://$${GITHUB_TOKEN}@github.com/grafana/grafana-enterprise.git"',
                    'cd grafana-enterprise',
                    'git checkout ${DRONE_COMMIT}',
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
                    'curl -fLO https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v{}/grabpl'.format(
                        grabpl_version
                    ),
                    'chmod +x grabpl',
                    'mv grabpl /tmp',
                    'mv grafana-enterprise /tmp/',
                    '/tmp/grabpl init-enterprise /tmp/grafana-enterprise{}'.format(source_commit),
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
            'commands': [
                'curl -fLO https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v{}/grabpl'.format(
                    grabpl_version
                ),
                'chmod +x grabpl',
                'mkdir -p bin',
                'mv grabpl bin',
            ] + common_cmds,
        },
    ]

    return steps

def enterprise_downstream_step(edition):
    if edition == 'enterprise':
        return None

    return {
        'name': 'trigger-enterprise-downstream',
        'image': 'grafana/drone-downstream',
        'settings': {
            'server': 'https://drone.grafana.net',
            'token': {
                'from_secret': 'drone_token',
            },
            'repositories': [
                'grafana/grafana-enterprise',
            ],
            'params': [
                'SOURCE_BUILD_NUMBER=${DRONE_BUILD_NUMBER}',
                'SOURCE_COMMIT=${DRONE_COMMIT}',
            ],
        },
    }

def lint_backend_step(edition):
    return {
        'name': 'lint-backend',
        'image': build_image,
        'environment': {
            # We need CGO because of go-sqlite3
            'CGO_ENABLED': '1',
        },
        'depends_on': [
            'initialize',
        ],
        'commands': [
            # Don't use Make since it will re-download the linters
            'golangci-lint run --config scripts/go/configs/.golangci.toml ./pkg/...',
            'revive -formatter stylish -config scripts/go/configs/revive.toml ./pkg/...',
            './scripts/revive-strict',
            './scripts/tidy-check.sh',
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

def build_storybook_step(edition):
    return {
        'name': 'build-storybook',
        'image': build_image,
        'depends_on': [
            # Best to ensure that this step doesn't mess with what's getting built and packaged
            'package',
        ],
        'commands': [
            'yarn storybook:build',
        ],
    }

def publish_storybook_step(edition):
    if edition == 'enterprise':
        return None

    return {
        'name': 'publish-storybook',
        'image': publish_image,
        'depends_on': [
            'build-storybook',
        ],
        'environment': {
            'GCP_KEY': {
                'from_secret': 'gcp_key',
            },
        },
        'commands': [
            'printenv GCP_KEY | base64 -d > /tmp/gcpkey.json',
            'gcloud auth activate-service-account --key-file=/tmp/gcpkey.json',
            'gsutil -m rsync -d -r ./packages/grafana-ui/dist/storybook gs://grafana-storybook/canary',
        ],
    }

def build_backend_step(edition, variants=None, is_downstream=False):
    if not is_downstream:
        build_no = '${DRONE_BUILD_NUMBER}'
    else:
        build_no = '$${SOURCE_BUILD_NUMBER}'
    if variants:
        variants_str = ' --variants {}'.format(','.join(variants))
    else:
        variants_str = ''
    return {
        'name': 'build-backend',
        'image': build_image,
        'depends_on': [
            'initialize',
            'lint-backend',
            'test-backend',
        ],
        'commands': [
            # TODO: Convert number of jobs to percentage
            './bin/grabpl build-backend --jobs 8 --edition {} --build-id {}{} --no-pull-enterprise'.format(
                edition, build_no, variants_str,
            ),
        ],
    }

def build_frontend_step(edition, is_downstream=False):
    if not is_downstream:
        build_no = '${DRONE_BUILD_NUMBER}'
    else:
        build_no = '$${SOURCE_BUILD_NUMBER}'
    return {
        'name': 'build-frontend',
        'image': build_image,
        'depends_on': [
            'initialize',
            'test-frontend',
        ],
        'commands': [
            # TODO: Use percentage for num jobs
            './bin/grabpl build-frontend --jobs 8 --no-install-deps --edition {} '.format(edition) +
                '--build-id {} --no-pull-enterprise'.format(build_no),
        ],
    }

def build_plugins_step(edition, sign=False):
    if sign:
        env = {
            'GRAFANA_API_KEY': {
                'from_secret': 'grafana_api_key',
            },
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

def test_backend_step():
    return {
        'name': 'test-backend',
        'image': build_image,
        'depends_on': [
            'initialize',
            'lint-backend',
        ],
        'commands': [
            # First execute non-integration tests in parallel, since it should be safe
            './bin/grabpl test-backend',
            # Then execute integration tests in serial
            './bin/grabpl integration-tests',
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
    if edition == 'enterprise':
        return None

    return {
        'name': 'publish-frontend-metrics',
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'environment': {
            'GRAFANA_MISC_STATS_API_KEY': {
                'from_secret': 'grafana_misc_stats_api_key',
            },
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
            'echo -e "unknwon\nreferer\nerrorstring\neror\niam" > words_to_ignore.txt',
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
        'environment': {
            'VERSION': '0.7.1',
            'CHKSUM': 'beca3d7819a6bdcfbd044576df4fc284053b48f468b2f03428fe66f4ceb2c05d9b5411357fa15003cb0' +
                '311406c255084cf7283a3b8fce644c340c2f6aa910b9f',
        },
        'commands': [
            'curl -fLO http://storage.googleapis.com/grafana-downloads/ci-dependencies/shellcheck-' +
                'v$${VERSION}.linux.x86_64.tar.xz',
            'echo $$CHKSUM shellcheck-v$${VERSION}.linux.x86_64.tar.xz | sha512sum --check --strict --status',
            'tar xf shellcheck-v$${VERSION}.linux.x86_64.tar.xz',
            'mv shellcheck-v$${VERSION}/shellcheck /usr/local/bin/',
            'rm -rf shellcheck-v$${VERSION}*',
            './bin/grabpl shellcheck',
        ],
    }

def package_step(edition, variants=None, sign=False, is_downstream=False):
    if not is_downstream:
        build_no = '${DRONE_BUILD_NUMBER}'
    else:
        build_no = '$${SOURCE_BUILD_NUMBER}'
    if variants:
        variants_str = ' --variants {}'.format(','.join(variants))
    else:
        variants_str = ''
    if sign:
        sign_args = ' --sign'
        env = {
            'GRAFANA_API_KEY': {
                'from_secret': 'grafana_api_key',
            },
            'GPG_PRIV_KEY': {
                'from_secret': 'gpg_priv_key',
            },
            'GPG_PUB_KEY': {
                'from_secret': 'gpg_pub_key',
            },
            'GPG_KEY_PASSWORD': {
                'from_secret': 'gpg_key_password',
            },
        }
        test_args = ''
    else:
        sign_args = ''
        env = None
        test_args = '. scripts/build/gpg-test-vars.sh && '

    return {
        'name': 'package',
        'image': build_image,
        'depends_on': [
            'build-backend',
            'build-frontend',
            'build-plugins',
            'test-backend',
            'test-frontend',
            'codespell',
            'shellcheck',
        ],
        'environment': env,
        'commands': [
            # TODO: Use percentage for jobs
            '{}./bin/grabpl package --jobs 8 --edition {} '.format(test_args, edition) +
                '--build-id {} --no-pull-enterprise{}{}'.format(build_no, variants_str, sign_args),
        ],
    }

def e2e_tests_server_step():
    return {
        'name': 'end-to-end-tests-server',
        'image': build_image,
        'detach': True,
        'depends_on': [
            'package',
        ],
        'commands': [
            './e2e/start-server',
        ],
    }

def e2e_tests_step():
    return {
        'name': 'end-to-end-tests',
        'image': 'grafana/ci-e2e:12.18-1',
        'depends_on': [
            'end-to-end-tests-server',
        ],
        'environment': {
            'HOST': 'end-to-end-tests-server',
        },
        'commands': [
            # Have to re-install Cypress since it insists on searching for its binary beneath /root/.cache,
            # even though the Yarn cache directory is beneath /usr/local/share somewhere
            './node_modules/.bin/cypress install',
            './bin/grabpl e2e-tests',
        ],
    }

def build_docs_website_step():
    return {
        'name': 'build-docs-website',
        # Use latest revision here, since we want to catch if it breaks
        'image': 'grafana/docs-base:latest',
        'depends_on': [
            'initialize',
        ],
        'commands': [
            'mkdir -p /hugo/content/docs/grafana',
            'cp -r docs/sources /hugo/content/docs/grafana/latest',
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
            'cp dist/*.tar.gz* packaging/docker/',
        ],
    }

def build_docker_images_step(edition, archs=None, ubuntu=False, publish=False):
    sfx = ''
    if ubuntu:
        sfx = '-ubuntu'
    settings = {
        'dry_run': not publish,
        'edition': edition,
        'ubuntu': ubuntu,
    }
    if publish:
        settings['username'] = {
            'from_secret': 'docker_user',
        }
        settings['password'] = {
            'from_secret': 'docker_password',
        }
    if archs:
        settings['archs'] = ','.join(archs)
    return {
        'name': 'build-docker-images' + sfx,
        'image': grafana_docker_image,
        'depends_on': [
            'copy-packages-for-docker',
        ],
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

def release_next_npm_packages_step(edition):
    if edition == 'enterprise':
        return None

    return {
        'name': 'release-next-npm-packages',
        'image': build_image,
        'depends_on': [
            'end-to-end-tests',
        ],
        'environment': {
            'NPM_TOKEN': {
                'from_secret': 'npm_token',
            },
        },
        'commands': [
            './node_modules/.bin/lerna bootstrap',
            'echo "//registry.npmjs.org/:_authToken=$${NPM_TOKEN}" >> ~/.npmrc',
            './scripts/circle-release-next-packages.sh',
        ],
    }

def deploy_to_kubernetes_step(edition, is_downstream):
    if edition != 'enterprise' or not is_downstream:
        return None

    return {
        'name': 'deploy-to-kubernetes',
        'image': alpine_image,
        'depends_on': [
            'build-docker-images',
        ],
        'environment': {
            'CIRCLE_TOKEN': {
                'from_secret': 'deployment_tools_circle_token',
            },
        },
        'commands': [
            './bin/grabpl deploy-to-k8s',
        ],
    }

def upload_packages_step(edition, is_downstream):
    if edition == 'enterprise' and not is_downstream:
        return None

    return {
        'name': 'upload-packages',
        'image': publish_image,
        'depends_on': [
            'package',
            'end-to-end-tests',
            'mysql-integration-tests',
            'postgres-integration-tests',
        ],
        'environment': {
            'GCP_GRAFANA_UPLOAD_KEY': {
                'from_secret': 'gcp_key',
            },
            'GRAFANA_COM_API_KEY': {
                'from_secret': 'grafana_api_key',
            },
            'GPG_PRIV_KEY': {
                'from_secret': 'gpg_priv_key',
            },
            'GPG_PUB_KEY': {
                'from_secret': 'gpg_pub_key',
            },
            'GPG_KEY_PASSWORD': {
                'from_secret': 'gpg_key_password',
            },
        },
        'commands': [
            './bin/grabpl upload-packages --edition {}'.format(edition),
        ],
    }

def publish_packages_step(edition, is_downstream):
    if edition == 'enterprise' and not is_downstream:
        return None

    if not is_downstream:
        build_no = '${DRONE_BUILD_NUMBER}'
    else:
        build_no = '$${SOURCE_BUILD_NUMBER}'

    return {
        'name': 'publish-packages',
        'image': publish_image,
        'depends_on': [
            'initialize',
        ],
        'environment': {
            'GRAFANA_COM_API_KEY': {
                'from_secret': 'grafana_api_key',
            },
        },
        'commands': [
            './bin/grabpl publish-packages --edition {} --build-id {}'.format(edition, build_no),
        ],
    }

def get_windows_steps(edition, version_mode, is_downstream=False):
    if not is_downstream:
        source_commit = ''
    else:
        source_commit = ' $$env:SOURCE_COMMIT'

    sfx = ''
    if edition == 'enterprise':
        sfx = '-enterprise'
    if not is_downstream:
        build_no = 'DRONE_BUILD_NUMBER'
    else:
        build_no = 'SOURCE_BUILD_NUMBER'
    steps = [
        {
            'name': 'initialize',
            'image': wix_image,
            'commands': [
                '$$ProgressPreference = "SilentlyContinue"',
                'Invoke-WebRequest https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v{}/windows/grabpl.exe -OutFile grabpl.exe'.format(grabpl_version),
            ],
        },
    ]
    if version_mode == 'master' and (edition != 'enterprise' or is_downstream):
        installer_commands = [
            '$$gcpKey = $$env:GCP_KEY',
            '[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($$gcpKey)) > gcpkey.json',
            # gcloud fails to read the file unless converted with dos2unix
            'dos2unix gcpkey.json',
            'gcloud auth activate-service-account --key-file=gcpkey.json',
            'rm gcpkey.json',
            'cp C:\\App\\nssm-2.24.zip .',
            '.\\grabpl.exe windows-installer --edition {} --build-id $$env:{}'.format(edition, build_no),
            '$$fname = ((Get-Childitem grafana*.msi -name) -split "`n")[0]',
            'gsutil cp $$fname gs://grafana-downloads/{}/{}/'.format(edition, version_mode),
            'gsutil cp "$$fname.sha256" gs://grafana-downloads/{}/{}/'.format(edition, version_mode),
        ]
        steps.append({
            'name': 'build-windows-installer',
            'image': wix_image,
            'environment': {
                'GCP_KEY': {
                    'from_secret': 'gcp_key',
                },
            },
            'commands': installer_commands,
            'depends_on': [
                'initialize',
            ],
        })

    if edition == 'enterprise':
        # For enterprise, we have to clone both OSS and enterprise and merge the latter into the former
        clone_commands = [
            'git clone "https://$$env:GITHUB_TOKEN@github.com/grafana/grafana-enterprise.git"',
        ]
        if not is_downstream:
            clone_commands.extend([
                'cd grafana-enterprise',
                'git checkout $$env:DRONE_COMMIT',
            ])
        steps.insert(0, {
            'name': 'clone',
            'image': wix_image,
            'environment': {
                'GITHUB_TOKEN': {
                    'from_secret': 'github_token',
                },
            },
            'commands': clone_commands,
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
