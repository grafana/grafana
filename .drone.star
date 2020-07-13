def main(ctx):
    return pr_pipeline_set()

build_image = 'grafana/build-container:1.2.21'
grafana_docker_image = 'grafana/drone-grafana-docker:0.2.0'
exclude_forks_cond = {
    'repo': {
        'include': [
            'grafana/grafana',
            'aknuds1/grafana',
        ],
    },
}

pr_kind = 'pr'

restore_yarn_cache = 'rm -rf $(yarn cache dir) && cp -r yarn-cache $(yarn cache dir)'
def install_deps(exclude_forks=False):
    obj = {
        'name': 'install-deps',
        'image': build_image,
        'environment': {
            'GRABPL_VERSION': '0.4.15',
            'DOCKERIZE_VERSION': '0.6.1',
        },
        'commands': [
            'curl -fLO https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v$${GRABPL_VERSION}/grabpl',
            'chmod +x grabpl',
            'mkdir -p bin',
            'mv grabpl bin',
            'curl -fLO https://github.com/jwilder/dockerize/releases/download/v$${DOCKERIZE_VERSION}/dockerize-linux-amd64-v$${DOCKERIZE_VERSION}.tar.gz',
            'tar -C bin -xzvf dockerize-linux-amd64-v$${DOCKERIZE_VERSION}.tar.gz',
            'rm dockerize-linux-amd64-v$${DOCKERIZE_VERSION}.tar.gz',
            'yarn install --frozen-lockfile --no-progress',
            # Keep the Yarn cache for subsequent steps
            'cp -r $(yarn cache dir) yarn-cache',
        ],
    }
    if exclude_forks:
        obj['when'] = exclude_forks_cond

    return obj

def pr_pipeline_set():
    return pipeline_set(kind=pr_kind, name='test-pr')

def pipeline_set(kind, name):
    """Generate a certain kind of pipeline set."""
    if kind not in [
        pr_kind,
    ]:
        # There should be a 'fail' function in Starlark, but won't build
        return []

    pipelines = [
        {
            'kind': 'pipeline',
            'type': 'docker',
            'name': '{}-oss'.format(name),
            'trigger': {
                'event': ['pull_request',],
            },
            'services': [
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
            ],
            'steps': [
                install_deps(),
                {
                    'name': 'lint-go',
                    'image': build_image,
                    'environment': {
                        # We need CGO because of go-sqlite3
                        'CGO_ENABLED': '1',
                    },
                    'depends_on': [
                      'install-deps',
                    ],
                    'commands': [
                        'make lint-go',
                    ],
                },
                {
                    'name': 'codespell',
                    'image': build_image,
                    'depends_on': [
                        'install-deps',
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
                        'install-deps',
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
                    'depends_on': [
                        'install-deps',
                        'lint-go',
                        'test-backend',
                    ],
                    'environment': {
                        'GITHUB_TOKEN': {
                            'from_secret': 'github_token',
                        },
                    },
                    'commands': [
                        'rm -rf $(go env GOCACHE) && cp -r go-cache $(go env GOCACHE)',
                        './bin/grabpl build-backend --github-token "$${GITHUB_TOKEN}" --edition oss ' +
                            '--build-id $DRONE_BUILD_NUMBER --variants linux-x64,linux-x64-musl,osx64,win64',
                    ],
                },
                {
                    'name': 'build-frontend',
                    'image': build_image,
                    'depends_on': [
                        'install-deps',
                        'test-frontend',
                    ],
                    'environment': {
                        'GITHUB_TOKEN': {
                            'from_secret': 'github_token',
                        },
                    },
                    'commands': [
                        restore_yarn_cache,
                        './bin/grabpl build-frontend --no-install-deps --github-token "$${GITHUB_TOKEN}" ' +
                            '--edition oss --build-id $DRONE_BUILD_NUMBER',
                    ],
                },
                {
                    'name': 'test-backend',
                    'image': build_image,
                    'depends_on': [
                        'install-deps',
                        'lint-go',
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
                        'install-deps',
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
                    'depends_on': [
                        'install-deps',
                        'lint-go',
                    ],
                    'commands': [
                        restore_yarn_cache,
                        './bin/grabpl build-plugins --edition oss --no-install-deps',
                    ],
                },
                {
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
                    'environment': {
                        'GITHUB_TOKEN': {
                            'from_secret': 'github_token',
                        },
                    },
                    'commands': [
                        '. scripts/build/gpg-test-vars.sh && ./bin/grabpl package --github-token ' +
                            '"$${GITHUB_TOKEN}" --edition oss --build-id $DRONE_BUILD_NUMBER ' +
                            '--variants linux-x64,linux-x64-musl,osx64,win64',
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
                {
                    'name': 'publish-storybook',
                    'image': build_image,
                    'depends_on': [
                        # Best to ensure that this step doesn't mess with what's getting built and packaged
                        'package',
                    ],
                    'commands': [
                        restore_yarn_cache,
                        'yarn storybook:build',
                        # TODO: Enable the following for non-forked PRs
                        # - echo $GCP_GRAFANA_UPLOAD_KEY > /tmp/gcpkey.json
                        # - gcloud auth activate-service-account --key-file=/tmp/gcpkey.json
                        # - gsutil -m rsync -d -r ./packages/grafana-ui/dist/storybook gs://grafana-storybook/latest
                        # - gsutil -m rsync -d -r ./packages/grafana-ui/dist/storybook gs://grafana-storybook/$CIRCLE_TAG
                    ],
                },
                {
                    'name': 'build-docs-website',
                    # Use latest revision here, since we want to catch if it breaks
                    'image': 'grafana/docs-base:latest',
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
                        'edition': 'oss',
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
                        # 'edition': 'oss',
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
            ],
        },
    ]

    if kind != pr_kind:
        # For now at least, we have to disable the enterprise pipeline for PRs, since PRs don't have access
        # to secrets with Drone (in Circle, you can share secrets with PRs internal to the repo).
        pipelines.append({
            'kind': 'pipeline',
            'type': 'docker',
            'name': '{}-enterprise'.format(name),
            'trigger': {
                'event': ['pull_request',],
            },
            'steps': [
                install_deps(exclude_forks=True),
                {
                    'name': 'build-backend',
                    'image': build_image,
                    'when': exclude_forks_cond,
                    'depends_on': [
                        'install-deps',
                    ],
                    'environment': {
                        'GITHUB_TOKEN': {
                            'from_secret': 'github_token',
                        },
                    },
                    'commands': [
                        './bin/grabpl build-backend --github-token "$${GITHUB_TOKEN}" --edition enterprise ' +
                            '--build-id $DRONE_BUILD_NUMBER --variants linux-x64,linux-x64-musl,osx64,win64',
                    ],
                },
                {
                    'name': 'build-frontend',
                    'image': build_image,
                    'when': exclude_forks_cond,
                    'depends_on': [
                        'install-deps',
                    ],
                    'environment': {
                        'GITHUB_TOKEN': {
                            'from_secret': 'github_token',
                        },
                    },
                    'commands': [
                        restore_yarn_cache,
                        './bin/grabpl build-frontend --no-install-deps --github-token "$${GITHUB_TOKEN}" ' +
                            '--edition enterprise --build-id $DRONE_BUILD_NUMBER',
                    ],
                },
                {
                    'name': 'build-plugins',
                    'image': build_image,
                    'when': exclude_forks_cond,
                    'depends_on': [
                        'install-deps',
                    ],
                    'commands': [
                        restore_yarn_cache,
                        './bin/grabpl build-plugins --edition enterprise --no-install-deps',
                    ],
                },
                {
                    'name': 'package',
                    'image': build_image,
                    'when': exclude_forks_cond,
                    'depends_on': [
                        'build-backend',
                        'build-frontend',
                        'build-plugins',
                    ],
                    'environment': {
                        'GITHUB_TOKEN': {
                            'from_secret': 'github_token',
                        },
                    },
                    'commands': [
                        '. scripts/build/gpg-test-vars.sh && ./bin/grabpl package --github-token ' +
                            '"$${GITHUB_TOKEN}" --edition enterprise --build-id $DRONE_BUILD_NUMBER ' +
                            '--variants linux-x64,linux-x64-musl,osx64,win64',
                    ],
                },
                {
                    'name': 'copy-packages-for-docker',
                    'image': build_image,
                    'when': exclude_forks_cond,
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
                    'when': exclude_forks_cond,
                    'depends_on': [
                        'copy-packages-for-docker',
                    ],
                    'settings': {
                        'dry_run': True,
                        'edition': 'enterprise',
                        'archs': 'amd64',
                    },
                },
                # {
                    # 'name': 'build-ubuntu-docker-images',
                    # 'image': grafana_docker_image,
                    # 'when': exclude_forks_cond,
                    # 'depends_on': [
                        # 'copy-packages-for-docker',
                    # ],
                    # 'settings': {
                        # 'dry_run': True,
                        # 'edition': 'enterprise',
                        # 'ubuntu': True,
                    # },
                # },
            ]
        })

    return pipelines
