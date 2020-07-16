build_image = 'grafana/build-container:1.2.21'
grafana_docker_image = 'grafana/drone-grafana-docker:0.2.0'

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
    steps = [
        lint_backend_step(edition),
        {
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
        },
        {
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
        },
        {
            'name': 'build-backend',
            'image': build_image,
            'environment': {
                'GF_EDITION': edition,
            },
            'depends_on': [
                'initialize',
                'lint-backend',
                'test-backend',
            ],
            'commands': [
                'rm -rf $(go env GOCACHE) && cp -r go-cache $(go env GOCACHE)',
                './bin/grabpl build-backend --edition $${GF_EDITION} --build-id $DRONE_BUILD_NUMBER ' +
                    '--variants linux-x64,linux-x64-musl,osx64,win64 --no-pull-enterprise',
            ],
        },
        {
            'name': 'build-frontend',
            'image': build_image,
            'environment': {
                'GF_EDITION': edition,
            },
            'depends_on': [
                'initialize',
                'test-frontend',
            ],
            'commands': [
                restore_yarn_cache,
                './bin/grabpl build-frontend --no-install-deps --edition $${GF_EDITION} ' +
                    '--build-id $DRONE_BUILD_NUMBER --no-pull-enterprise',
            ],
        },
        {
            'name': 'test-backend',
            'image': build_image,
            'depends_on': [
                'initialize',
                'lint-backend',
            ],
            'commands': [
                # First execute non-integration tests in parallel, since it should be safe
                'go test -covermode=atomic ./pkg/...',
                # Then execute integration tests in serial
                './bin/grabpl integration-tests',
                # Keep the test cache
                'cp -r $(go env GOCACHE) go-cache',
            ],
        },
        {
            'name': 'test-frontend',
            'image': build_image,
            'depends_on': [
                'initialize',
            ],
            'commands': [
                restore_yarn_cache,
                'yarn run prettier:check',
                'yarn run packages:typecheck',
                'yarn run typecheck',
                'yarn run test',
            ],
        },
        {
            'name': 'build-plugins',
            'image': build_image,
            'environment': {
                'GF_EDITION': edition,
            },
            'depends_on': [
                'initialize',
                'lint-backend',
            ],
            'commands': [
                restore_yarn_cache,
                './bin/grabpl build-plugins --edition $${GF_EDITION} --no-install-deps',
            ],
        },
        {
            'name': 'package',
            'image': build_image,
            'environment': {
                'GF_EDITION': edition,
            },
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
                '. scripts/build/gpg-test-vars.sh && ./bin/grabpl package --edition $${GF_EDITION} ' +
                    '--build-id $DRONE_BUILD_NUMBER --variants linux-x64,linux-x64-musl,osx64,win64 ' +
                    '--no-pull-enterprise',
            ],
        },
        {
            'name': 'end-to-end-tests-server',
            'image': build_image,
            'detach': True,
            'depends_on': [
                'package',
            ],
            'commands': [
                './e2e/start-server',
            ],
        },
        {
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
        },
                build_storybook_step(edition),
        {
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
        },
        {
            'name': 'copy-packages-for-docker',
            'image': build_image,
            'depends_on': [
                'package',
            ],
            'commands': [
                'cp dist/*.tar.gz packaging/docker/',
            ],
        },
        {
            'name': 'build-docker-images',
            'image': grafana_docker_image,
            'depends_on': [
                'copy-packages-for-docker',
            ],
            'settings': {
                'dry_run': True,
                'edition': edition,
                'archs': 'amd64',
            },
        },
        # {
            # 'name': 'build-ubuntu-docker-images',
            # 'image': grafana_docker_image,
            # 'depends_on': [
                # 'copy-packages-for-docker',
            # ],
            # 'settings': {
                # 'dry_run': True,
                # 'edition': edition,
                # 'ubuntu': True,
            # },
        # },
        {
            'name': 'postgres-integration-test',
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
        },
        {
            'name': 'mysql-integration-test',
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
        },
    ]
    return [
        pipeline(
            name='test-pr', edition=edition, triggers={'event': ['pull_request',],}, services=services, steps=steps
        ),
    ]

def master_pipelines(edition):
    return []

def pipeline(name, edition, triggers, steps, services=[]):
    pipeline = {
        'kind': 'pipeline',
        'type': 'docker',
        'name': name,
        'trigger': triggers,
        'services': services,
        'steps': init_steps(edition) + steps,
    }
    if edition == 'enterprise':
        # We have a custom clone step for enterprise
        pipeline['clone'] = {
            'disable': True,
        }

    return pipeline

def init_steps(edition):
    grabpl_version = '0.4.24'
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
                    'git clone https://$${GITHUB_TOKEN}@github.com/grafana/grafana-enterprise.git',
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
    cmd = 'make lint-go'
    if edition == 'enterprise':
        cmd = 'GO_FILES=./pkg/extensions make lint-go'

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
            cmd,
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
            # TODO: Enable the following for OSS master builds
            # - echo $GCP_GRAFANA_UPLOAD_KEY > /tmp/gcpkey.json
            # - gcloud auth activate-service-account --key-file=/tmp/gcpkey.json
            # - gsutil -m rsync -d -r ./packages/grafana-ui/dist/storybook gs://grafana-storybook/latest
            # - gsutil -m rsync -d -r ./packages/grafana-ui/dist/storybook gs://grafana-storybook/$CIRCLE_TAG
        ],
    }
