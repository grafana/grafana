def main(ctx):
    return [
        pr_pipeline(),
    ]

build_image = 'grafana/build-container:1.2.21'
exclude_forks = {
    'repo': {
        'include': [
            'grafana/grafana',
            'aknuds1/grafana',
        ],
    },
}

pr_kind = 'pr'

restore_yarn_cache = 'rm -rf $(yarn cache dir) && cp -r yarn-cache $(yarn cache dir)'

def pr_pipeline():
    return pipeline(kind=pr_kind, name='Test PR')

def pipeline(kind, name):
    """Generate a certain kind of pipeline."""
    if kind not in [
        pr_kind,
    ]:
        # There should be a 'fail' function in Starlark, but won't build
        return {}

    return {
        'kind': 'pipeline',
        'type': 'docker',
        'name': name,
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
        ],
        'steps': [
            {
                'name': 'install-deps',
                'image': build_image,
                'environment': {
                    'GRABPL_VERSION': '0.4.13',
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
            },
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
                    'make scripts/go/bin/revive scripts/go/bin/gosec',
                    'go vet ./pkg/...',
                    'golangci-lint run -v --config scripts/go/configs/ci/.golangci.yml -E deadcode ' +
                        '-E gofmt -E gosimple -E ineffassign -E structcheck -E typecheck ./pkg/...',
                    'golangci-lint run -v --config scripts/go/configs/ci/.golangci.yml -E unconvert -E unused ' +
                        '-E varcheck -E goconst -E errcheck -E staticcheck ./pkg/...',
                    './scripts/go/bin/revive -formatter stylish -config ./scripts/go/configs/revive.toml ./pkg/...',
                    './scripts/go/bin/revive -formatter stylish -config ./scripts/go/configs/revive-strict.toml ' +
                        '-exclude ./pkg/plugins/backendplugin/pluginextensionv2/... ' +
                        './pkg/services/alerting/... ' +
                        './pkg/services/provisioning/datasources/... ' +
                        './pkg/services/provisioning/dashboards/... ' +
                        './pkg/plugins/backendplugin/...',
                    './scripts/go/bin/gosec -quiet -exclude=G104,G107,G108,G201,G202,G204,G301,G304,G401,G402,G501 ' +
                        '-conf=./scripts/go/configs/gosec.json ./pkg/...',
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
                'name': 'build-oss-backend',
                'image': build_image,
                'depends_on': [
                    'install-deps',
                    'lint-go',
                ],
                'environment': {
                    'GITHUB_TOKEN': {
                        'from_secret': 'github_token',
                    },
                },
                'commands': [
                    './bin/grabpl build-backend --github-token "$${GITHUB_TOKEN}" --edition oss --build-id ' +
                        '$DRONE_BUILD_NUMBER',
                ],
            },
            {
                'name': 'create-enterprise-repo',
                'image': build_image,
                'when': exclude_forks,
                'depends_on': [
                    'install-deps',
                ],
                'commands': [
                    'git clone . grafana-enterprise',
                    'cd grafana-enterprise',
                    'mkdir -p bin',
                    'cp ../bin/grabpl ./bin/',
                    'yarn install --frozen-lockfile --no-progress',
                ],
            },
            {
                'name': 'build-enterprise-backend',
                'image': build_image,
                'when': exclude_forks,
                'depends_on': [
                    'create-enterprise-repo',
                    'lint-go',
                ],
                'environment': {
                    'GITHUB_TOKEN': {
                        'from_secret': 'github_token',
                    },
                },
                'commands': [
                    'cd grafana-enterprise',
                    './bin/grabpl build-backend --github-token "$${GITHUB_TOKEN}" --edition enterprise ' +
                        '--build-id $DRONE_BUILD_NUMBER',
                ],
            },
            {
                'name': 'build-enterprise-frontend',
                'image': build_image,
                'depends_on': [
                    'create-enterprise-repo',
                ],
                'environment': {
                    'GITHUB_TOKEN': {
                        'from_secret': 'github_token',
                    },
                },
                'commands': [
                    restore_yarn_cache,
                    'cd grafana-enterprise',
                    './bin/grabpl build-frontend --no-install-deps --github-token "$${GITHUB_TOKEN}" ' +
                        '--edition enterprise --build-id $DRONE_BUILD_NUMBER',
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
                    'go test -tags=integration -covermode=atomic ./pkg/...',
                ],
            },
            {
                'name': 'build-oss-frontend',
                'image': build_image,
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
                        '--edition oss --build-id $DRONE_BUILD_NUMBER',
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
                'name': 'build-oss-plugins',
                'image': build_image,
                'depends_on': [
                    'install-deps',
                    'lint-go',
                    'test-frontend',
                ],
                'commands': [
                    restore_yarn_cache,
                    './bin/grabpl build-plugins --edition oss --no-install-deps',
                ],
            },
            {
                'name': 'build-enterprise-plugins',
                'image': build_image,
                'depends_on': [
                    'create-enterprise-repo',
                    'lint-go',
                    'test-frontend',
                ],
                'commands': [
                    restore_yarn_cache,
                    'cd grafana-enterprise',
                    './bin/grabpl build-plugins --edition enterprise --no-install-deps',
                ],
            },
            {
                'name': 'package-oss',
                'image': build_image,
                'depends_on': [
                    'build-oss-backend',
                    'build-oss-frontend',
                    'build-oss-plugins',
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
                        '"$${GITHUB_TOKEN}" --edition oss --build-id $DRONE_BUILD_NUMBER',
                ],
            },
            {
                'name': 'package-enterprise',
                'image': build_image,
                'depends_on': [
                    'build-enterprise-backend',
                    'build-enterprise-frontend',
                    'build-enterprise-plugins',
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
                    'cd grafana-enterprise',
                    '. scripts/build/gpg-test-vars.sh && ./bin/grabpl package --github-token ' +
                        '"$${GITHUB_TOKEN}" --edition enterprise --build-id $DRONE_BUILD_NUMBER',
                ],
            },
            {
                'name': 'end-to-end-tests-server',
                'image': build_image,
                'detach': True,
                'depends_on': [
                    'package-oss',
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
                    'package-oss',
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
                'name': 'copy-oss-packages-for-docker',
                'image': build_image,
                'depends_on': [
                    'package-oss',
                ],
                'commands': [
                    'cp dist/*.tar.gz packaging/docker/',
                ],
            },
            {
                'name': 'build-oss-docker-images',
                'image': 'grafana/drone-grafana-docker',
                'depends_on': [
                    'copy-oss-packages-for-docker',
                ],
                'settings': {
                    'dry_run': True,
                    'edition': 'oss',
                },
            },
            {
                'name': 'build-oss-ubuntu-docker-images',
                'image': 'grafana/drone-grafana-docker',
                'depends_on': [
                    'copy-oss-packages-for-docker',
                ],
                'settings': {
                    'dry_run': True,
                    'edition': 'oss',
                    'ubuntu': True,
                },
            },
            {
                'name': 'copy-enterprise-packages-for-docker',
                'image': build_image,
                'depends_on': [
                    'package-enterprise',
                ],
                'commands': [
                    'cd grafana-enterprise',
                    'cp dist/*.tar.gz packaging/docker/',
                ],
            },
            {
                'name': 'build-enterprise-docker-images',
                'image': 'grafana/drone-grafana-docker',
                'depends_on': [
                    'copy-enterprise-packages-for-docker',
                ],
                'settings': {
                    'dry_run': True,
                    'directory': 'grafana-enterprise',
                    'edition': 'enterprise',
                },
            },
            {
                'name': 'build-enterprise-ubuntu-docker-images',
                'image': 'grafana/drone-grafana-docker',
                'depends_on': [
                    'copy-enterprise-packages-for-docker',
                ],
                'settings': {
                    'dry_run': True,
                    'directory': 'grafana-enterprise',
                    'edition': 'enterprise',
                    'ubuntu': True,
                },
            },
            {
                'name': 'postgres-integration-test',
                'image': build_image,
                'depends_on': [
                    'test-backend',
                    'test-frontend',
                ],
                'environment': {
                    'PGPASSWORD': 'grafanatest',
                },
                'commands': [
                    'apt-get update',
                    'apt-get install -yq postgresql-client',
                    './bin/dockerize -wait tcp://postgres:5432 -timeout 120s',
                    'psql -p 5432 -h postgres -U grafanatest -d grafanatest -f ' +
                        'devenv/docker/blocks/postgres_tests/setup.sql',
                    './scripts/circle-test-postgres.sh',
                ],
            },
        ],
    }
