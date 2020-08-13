build_image = 'grafana/build-container:1.2.24'
publish_image = 'grafana/grafana-ci-deploy:1.2.5'
grafana_docker_image = 'grafana/drone-grafana-docker:0.2.0'
alpine_image = 'alpine:3.12'

restore_yarn_cache = 'rm -rf $(yarn cache dir) && cp -r yarn-cache $(yarn cache dir)'

def pr_pipelines(edition):
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
        build_backend_step(edition=edition, variants=variants),
        build_frontend_step(edition=edition),
        test_backend_step(),
        test_frontend_step(),
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
    return [
        pipeline(
            name='test-pr', edition=edition, trigger={
                'event': ['pull_request',],
            }, services=services, steps=steps
        ),
    ]

def master_pipelines(edition):
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
    steps = [
        lint_backend_step(edition),
        codespell_step(),
        shellcheck_step(),
        build_backend_step(edition=edition),
        build_frontend_step(edition=edition),
        test_backend_step(),
        test_frontend_step(),
        build_plugins_step(edition=edition),
        package_step(edition=edition),
        e2e_tests_server_step(),
        e2e_tests_step(),
        build_storybook_step(edition=edition),
        publish_storybook_step(edition=edition),
        build_docs_website_step(),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition=edition),
        build_docker_images_step(edition=edition, ubuntu=True),
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
        build_windows_installer_step(),
        release_next_npm_packages_step(edition),
        publish_packages_step(edition),
        deploy_to_kubernetes_step(edition),
    ]
    return [
        pipeline(
            name='test-master', edition=edition, trigger={
                'event': ['push',],
                'branch': 'master',
            }, services=services, steps=steps
        ),
    ]

def pipeline(name, edition, trigger, steps, services=[]):
    pipeline = {
        'kind': 'pipeline',
        'type': 'docker',
        'name': name,
        'trigger': trigger,
        'services': services,
        'steps': init_steps(edition) + steps,
    }
    if edition == 'enterprise':
        # We have a custom clone step for enterprise
        pipeline['clone'] = {
            'disable': True,
        }

    pipeline['steps'].insert(0, {
        'name': 'identify-runner',
        'image': alpine_image,
        'commands': [
            'echo $DRONE_RUNNER_NAME',
        ],
    })

    return pipeline

def init_steps(edition):
    grabpl_version = '0.4.25'
    common_cmds = [
        'curl -fLO https://github.com/jwilder/dockerize/releases/download/v$${DOCKERIZE_VERSION}/dockerize-linux-amd64-v$${DOCKERIZE_VERSION}.tar.gz',
        'tar -C bin -xzvf dockerize-linux-amd64-v$${DOCKERIZE_VERSION}.tar.gz',
        'rm dockerize-linux-amd64-v$${DOCKERIZE_VERSION}.tar.gz',
        'yarn install --frozen-lockfile --no-progress',
        # Keep the Yarn cache for subsequent steps
        'cp -r $(yarn cache dir) yarn-cache',
    ]
    if edition == 'enterprise':
        return [
            {
                'name': 'clone',
                'image': 'alpine/git:v2.26.2',
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
                    'GRABPL_VERSION': grabpl_version,
                    'DOCKERIZE_VERSION': '0.6.1',
                },
                'depends_on': [
                    'clone',
                ],
                'commands': [
                    'curl -fLO https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v$${GRABPL_VERSION}/grabpl',
                    'chmod +x grabpl',
                    'mv grabpl /tmp',
                    'mv grafana-enterprise /tmp/',
                    '/tmp/grabpl init-enterprise /tmp/grafana-enterprise',
                    'mkdir bin',
                    'mv /tmp/grabpl bin/'
                ] + common_cmds,
            },
        ]

    return [
        {
            'name': 'initialize',
            'image': build_image,
            'environment': {
                'GRABPL_VERSION': grabpl_version,
                'DOCKERIZE_VERSION': '0.6.1',
            },
            'commands': [
                'curl -fLO https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v$${GRABPL_VERSION}/grabpl',
                'chmod +x grabpl',
                'mkdir -p bin',
                'mv grabpl bin',
            ] + common_cmds,
        },
    ]

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
        ],
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
            restore_yarn_cache,
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
            'echo gsutil -m rsync -d -r ./packages/grafana-ui/dist/storybook gs://grafana-storybook/canary',
        ],
    }

def build_backend_step(edition, variants=None):
    if variants:
        variants_str = ' --variants {} --no-pull-enterprise'.format(','.join(variants))
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
            'rm -rf $(go env GOCACHE) && cp -r go-cache $(go env GOCACHE)',
            # TODO: Convert number of jobs to percentage
            './bin/grabpl build-backend --jobs 8 --edition {} --build-id $DRONE_BUILD_NUMBER{}'.format(
                edition, variants_str
            ),
        ],
    }

def build_frontend_step(edition):
    return {
        'name': 'build-frontend',
        'image': build_image,
        'depends_on': [
            'initialize',
            'test-frontend',
        ],
        'commands': [
            restore_yarn_cache,
            # TODO: Use percentage for num jobs
            './bin/grabpl build-frontend --jobs 8 --no-install-deps --edition {} '.format(edition) +
                '--build-id $DRONE_BUILD_NUMBER --no-pull-enterprise',
        ],
    }

def build_plugins_step(edition):
    return {
        'name': 'build-plugins',
        'image': build_image,
        'depends_on': [
            'initialize',
            'lint-backend',
        ],
        'commands': [
            restore_yarn_cache,
            # TODO: Use percentage for num jobs
            './bin/grabpl build-plugins --jobs 8 --edition {} --no-install-deps'.format(edition),
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
            # Keep the test cache
            'cp -r $(go env GOCACHE) go-cache',
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
            restore_yarn_cache,
            'yarn run prettier:check',
            'yarn run packages:typecheck',
            'yarn run typecheck',
            'yarn run test',
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

def package_step(edition, variants=None):
    if variants:
        variants_str = ' --variants {}'.format(','.join(variants))
    else:
        variants_str = ''
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
        'commands': [
            # TODO: Use percentage for jobs
            '. scripts/build/gpg-test-vars.sh && ./bin/grabpl package --jobs 8 --edition {} '.format(edition) +
                '--build-id $DRONE_BUILD_NUMBER --no-pull-enterprise' + variants_str,
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
            restore_yarn_cache,
            # Have to re-install Cypress since it insists on searching for its binary beneath /root/.cache,
            # even though the Yarn cache directory is beneath /usr/local/share somewhere
            './node_modules/.bin/cypress install',
            './e2e/wait-for-grafana',
            './e2e/run-suite',
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
            'cp dist/*.tar.gz packaging/docker/',
        ],
    }

def build_docker_images_step(edition, archs=None, ubuntu=False):
    sfx = ''
    if ubuntu:
        sfx = '-ubuntu'
    settings = {
        'dry_run': True,
        'edition': edition,
        'ubuntu': ubuntu,
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
            'rm -rf $(go env GOCACHE) && cp -r go-cache $(go env GOCACHE)',
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
            'rm -rf $(go env GOCACHE) && cp -r go-cache $(go env GOCACHE)',
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
            'npx lerna bootstrap',
            'echo "//registry.npmjs.org/:_authToken=$${NPM_TOKEN}" >> ~/.npmrc',
            # TODO: Enable
            'echo ./scripts/circle-release-next-packages.sh',
        ],
    }

def deploy_to_kubernetes_step(edition):
    if edition != 'enterprise':
        return None

    return {
        'name': 'deploy-to-kubernetes',
        'image': alpine_image,
        'depends_on': [
            'build-docker-images',
        ],
        'commands': [
            # TODO: Enable
            'echo ./bin/grabpl deploy-to-k8s',
        ],
    }

def publish_packages_step(edition):
    return {
        'name': 'publish-packages',
        'image': publish_image,
        'depends_on': [
            'package',
            # TODO
            # 'build-windows-installer',
            'end-to-end-tests',
            'mysql-integration-tests',
            'postgres-integration-tests',
        ],
        'commands': [
            # TODO: Enable
            'echo ./bin/grabpl publish-packages --edition {}'.format(edition),
        ],
    }

def build_windows_installer_step():
    # TODO: Build Windows installer, waiting on Brian to fix the build image
    return {
        'name': 'build-windows-installer',
        # TODO: Need new image that can execute as root
        'image': 'grafana/wix-toolset-ci:v3',
        'depends_on': [
            'package',
        ],
        'commands': [
          # TODO: Enable. Waiting on Brian to fix image.
          'echo ./scripts/build/ci-msi-build/ci-msi-build-oss.sh',
        ],
    }
