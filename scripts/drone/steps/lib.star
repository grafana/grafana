load('scripts/drone/vault.star', 'from_secret', 'github_token', 'pull_secret', 'drone_token', 'prerelease_bucket')

grabpl_version = 'v3.0.6'
build_image = 'grafana/build-container:1.6.1'
publish_image = 'grafana/grafana-ci-deploy:1.3.3'
deploy_docker_image = 'us.gcr.io/kubernetes-dev/drone/plugins/deploy-image'
alpine_image = 'alpine:3.15.6'
curl_image = 'byrnedo/alpine-curl:0.1.8'
windows_image = 'mcr.microsoft.com/windows:1809'
wix_image = 'grafana/ci-wix:0.1.1'
go_image = 'golang:1.19.1'

disable_tests = False
trigger_oss = {
    'repo': [
        'grafana/grafana',
    ]
}
trigger_storybook = {
    'paths': {
        'include': [
            'packages/grafana-ui/**',
        ],
    }
}


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

def yarn_install_step():
    return {
        'name': 'yarn-install',
        'image': build_image,
        'commands': [
            'yarn install --immutable',
        ],
        'depends_on': [
            'grabpl',
        ],
    }


def wire_install_step():
    return {
        'name': 'wire-install',
        'image': build_image,
        'commands': [
            'make gen-go',
        ],
        'depends_on': [
            'verify-gen-cue',
        ],
    }


def identify_runner_step(platform='linux'):
    if platform == 'windows':
        return {
            'name': 'identify-runner',
            'image': windows_image,
            'commands': [
                'echo $env:DRONE_RUNNER_NAME',
            ],
        }
    else:
        return {
            'name': 'identify-runner',
            'image': alpine_image,
            'commands': [
                'echo $DRONE_RUNNER_NAME',
            ],
        }


def clone_enterprise_step(ver_mode):
    if ver_mode == 'release':
        committish = '${DRONE_TAG}'
    elif ver_mode == 'release-branch':
        committish = '${DRONE_BRANCH}'
    else:
        committish = '${DRONE_COMMIT}'
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

def init_enterprise_step(ver_mode):
    source_commit = ''
    if ver_mode == 'release':
        source_commit = ' ${DRONE_TAG}'
        environment = {
            'GITHUB_TOKEN': from_secret(github_token),
        }
        token = "--github-token $${GITHUB_TOKEN}"
    elif ver_mode == 'release-branch':
        environment = {}
        token = ""
    else:
        environment = {}
        token = ""
    return {
        'name': 'init-enterprise',
        'image': build_image,
        'depends_on': [
            'clone-enterprise',
        ],
        'environment': environment,
        'commands': [
            'mv bin/grabpl /tmp/',
            'rmdir bin',
            'mv grafana-enterprise /tmp/',
            '/tmp/grabpl init-enterprise {} /tmp/grafana-enterprise{}'.format(token, source_commit),
            'mv /tmp/grafana-enterprise/deployment_tools_config.json deployment_tools_config.json',
            'mkdir bin',
            'mv /tmp/grabpl bin/'
        ],
    }


def download_grabpl_step(platform="linux"):
    if platform == 'windows':
        return {
            'name': 'grabpl',
            'image': wix_image,
            'commands': [
                '$$ProgressPreference = "SilentlyContinue"',
                'Invoke-WebRequest https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/{}/windows/grabpl.exe -OutFile grabpl.exe'.format(
                    grabpl_version),
            ]
        }

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


def lint_drone_step():
    return {
        'name': 'lint-drone',
        'image': curl_image,
        'commands': [
            './bin/grabpl verify-drone',
        ],
        'depends_on': [
            'grabpl',
        ],
    }

def enterprise_downstream_step(edition, ver_mode):
    if edition in ('enterprise', 'enterprise2'):
        return None

    repo = 'grafana/grafana-enterprise@'
    if ver_mode == 'pr':
        repo += '${DRONE_SOURCE_BRANCH}'
    else:
        repo += 'main'

    step = {
        'name': 'trigger-enterprise-downstream',
        'image': 'grafana/drone-downstream',
        'settings': {
            'server': 'https://drone.grafana.net',
            'token': from_secret(drone_token),
            'repositories': [
                repo,
            ],
            'params': [
                'SOURCE_BUILD_NUMBER=${DRONE_COMMIT}',
                'SOURCE_COMMIT=${DRONE_COMMIT}',
            ],
        },
    }

    if ver_mode == 'pr':
        step.update({ 'failure': 'ignore' })
        step['settings']['params'].append('OSS_PULL_REQUEST=${DRONE_PULL_REQUEST}')

    return step


def lint_backend_step(edition):
    return {
        'name': 'lint-backend' + enterprise2_suffix(edition),
        'image': build_image,
        'environment': {
            # We need CGO because of go-sqlite3
            'CGO_ENABLED': '1',
        },
        'depends_on': [
            'wire-install',
        ],
        'commands': [
            # Don't use Make since it will re-download the linters
            'make lint-go',
        ],
    }


def benchmark_ldap_step():
    return {
        'name': 'benchmark-ldap',
        'image': build_image,
        'environment': {
            'LDAP_HOSTNAME': 'ldap',
        },
        'commands': [
            'dockerize -wait tcp://ldap:389 -timeout 120s',
            'go test -benchmem -run=^$ ./pkg/extensions/ldapsync -bench "^(Benchmark50Users)$"',
        ],
    }


def build_storybook_step(edition, ver_mode):
    if edition in ('enterprise', 'enterprise2'):
        return None

    return {
        'name': 'build-storybook',
        'image': build_image,
        'depends_on': [
            # Best to ensure that this step doesn't mess with what's getting built and packaged
            'build-frontend',
            'build-frontend-packages',
        ],
        'environment': {
            'NODE_OPTIONS': '--max_old_space_size=4096',
        },
        'commands': [
            'yarn storybook:build',
            './bin/grabpl verify-storybook',
        ],
        'when': trigger_storybook,
    }


def store_storybook_step(edition, ver_mode, trigger=None):
    if edition in ('enterprise', 'enterprise2'):
        return None

    commands = []
    if ver_mode == 'release':
        commands.extend([
            './bin/grabpl store-storybook --deployment latest --src-bucket grafana-prerelease --src-dir artifacts/storybook',
            './bin/grabpl store-storybook --deployment ${DRONE_TAG} --src-bucket grafana-prerelease --src-dir artifacts/storybook',
        ])

    else:
        # main pipelines should deploy storybook to grafana-storybook/canary public bucket
        commands = ['./bin/grabpl store-storybook --deployment canary --src-bucket grafana-storybook', ]

    step = {
        'name': 'store-storybook',
        'image': publish_image,
        'depends_on': ['build-storybook', ] + end_to_end_tests_deps(edition),
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
            'PRERELEASE_BUCKET': from_secret(prerelease_bucket)
        },
        'commands': commands,
        'when': trigger_storybook,
    }
    if trigger and ver_mode in ("release-branch", "main"):
        # no dict merge operation available, https://github.com/harness/drone-cli/pull/220
        when_cond = {
            'repo': ['grafana/grafana',],
            'paths': {
                'include': [
                    'packages/grafana-ui/**',
                ],
            }
        }
        step = dict(step, when=when_cond)
    return step


def e2e_tests_artifacts(edition):
    return {
        'name': 'e2e-tests-artifacts-upload' + enterprise2_suffix(edition),
        'image': 'google/cloud-sdk:367.0.0',
        'depends_on': [
            'end-to-end-tests-dashboards-suite',
            'end-to-end-tests-panels-suite',
            'end-to-end-tests-smoke-tests-suite',
            'end-to-end-tests-various-suite',
        ],
        'when': {
            'status': [
                'success',
                'failure',
            ]
        },
        'environment': {
            'GCP_GRAFANA_UPLOAD_ARTIFACTS_KEY': from_secret('gcp_upload_artifacts_key'),
            'E2E_TEST_ARTIFACTS_BUCKET': 'releng-pipeline-artifacts-dev',
            'GITHUB_TOKEN': from_secret('github_token'),
        },
        'commands': [
            'apt-get update',
            'apt-get install -yq zip',
            'ls -lah ./e2e',
            'find ./e2e -type f -name "*.mp4"',
            'printenv GCP_GRAFANA_UPLOAD_ARTIFACTS_KEY > /tmp/gcpkey_upload_artifacts.json',
            'gcloud auth activate-service-account --key-file=/tmp/gcpkey_upload_artifacts.json',
            # we want to only include files in e2e folder that end with .spec.ts.mp4
            'find ./e2e -type f -name "*spec.ts.mp4" | zip e2e/videos.zip -@',
            'gsutil cp e2e/videos.zip gs://$${E2E_TEST_ARTIFACTS_BUCKET}/${DRONE_BUILD_NUMBER}/artifacts/videos/videos.zip',
            'export E2E_ARTIFACTS_VIDEO_ZIP=https://storage.googleapis.com/$${E2E_TEST_ARTIFACTS_BUCKET}/${DRONE_BUILD_NUMBER}/artifacts/videos/videos.zip',
            'echo "E2E Test artifacts uploaded to: $${E2E_ARTIFACTS_VIDEO_ZIP}"',
            'curl -X POST https://api.github.com/repos/${DRONE_REPO}/statuses/${DRONE_COMMIT_SHA} -H "Authorization: token $${GITHUB_TOKEN}" -d ' +
            '"{\\"state\\":\\"success\\",\\"target_url\\":\\"$${E2E_ARTIFACTS_VIDEO_ZIP}\\", \\"description\\": \\"Click on the details to download e2e recording videos\\", \\"context\\": \\"e2e_artifacts\\"}"',
        ],
    }


def upload_cdn_step(edition, ver_mode, trigger=None):
    deps = []
    if edition in 'enterprise2':
        deps.extend([
            'package' + enterprise2_suffix(edition),
        ])
    else:
        deps.extend([
            'grafana-server',
        ])

    step = {
        'name': 'upload-cdn-assets' + enterprise2_suffix(edition),
        'image': publish_image,
        'depends_on': deps,
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
            'PRERELEASE_BUCKET': from_secret(prerelease_bucket)
        },
        'commands': [
            './bin/grabpl upload-cdn --edition {}'.format(edition),
        ],
    }
    if trigger and ver_mode in ("release-branch", "main"):
        step = dict(step, when=trigger)
    return step


def build_backend_step(edition, ver_mode, variants=None):
    variants_str = ''
    if variants:
        variants_str = ' --variants {}'.format(','.join(variants))

    # TODO: Convert number of jobs to percentage
    if ver_mode == 'release':
        cmds = [
            './bin/build build-backend --jobs 8 --edition {} ${{DRONE_TAG}}'.format(
                edition,
            ),
        ]
    else:
        build_no = '${DRONE_BUILD_NUMBER}'
        cmds = [
            './bin/build build-backend --jobs 8 --edition {} --build-id {}{}'.format(
                edition, build_no, variants_str,
            ),
        ]

    return {
        'name': 'build-backend' + enterprise2_suffix(edition),
        'image': build_image,
        'depends_on': [
            'wire-install',
            'compile-build-cmd',
        ],
        'commands': cmds,
    }


def build_frontend_step(edition, ver_mode):
    build_no = '${DRONE_BUILD_NUMBER}'

    # TODO: Use percentage for num jobs
    if ver_mode == 'release':
        cmds = [
            './bin/build build-frontend --jobs 8 ' + \
            '--edition {} ${{DRONE_TAG}}'.format(edition),
        ]
    else:
        cmds = [
            './bin/build build-frontend --jobs 8 --edition {} '.format(edition) + \
            '--build-id {}'.format(build_no),
        ]

    return {
        'name': 'build-frontend',
        'image': build_image,
        'environment': {
            'NODE_OPTIONS': '--max_old_space_size=8192',
        },
        'depends_on': [
            'compile-build-cmd',
            'yarn-install',
        ],
        'commands': cmds,
    }


def build_frontend_package_step(edition, ver_mode):
    build_no = '${DRONE_BUILD_NUMBER}'

    # TODO: Use percentage for num jobs
    if ver_mode == 'release':
        cmds = [
            './bin/build build-frontend-packages --jobs 8 ' + \
            '--edition {} ${{DRONE_TAG}}'.format(edition),
        ]
    else:
        cmds = [
            './bin/build build-frontend-packages --jobs 8 --edition {} '.format(edition) + \
            '--build-id {}'.format(build_no),
        ]

    return {
        'name': 'build-frontend-packages',
        'image': build_image,
        'environment': {
            'NODE_OPTIONS': '--max_old_space_size=8192',
        },
        'depends_on': [
            'yarn-install',
        ],
        'commands': cmds,
    }


def build_plugins_step(edition, ver_mode):
    if ver_mode!='pr':
        env = {
            'GRAFANA_API_KEY': from_secret('grafana_api_key'),
        }
    else:
        env = None
    return {
        'name': 'build-plugins',
        'image': build_image,
        'environment': env,
        'depends_on': [
            'yarn-install',
        ],
        'commands': [
            # TODO: Use percentage for num jobs
            './bin/build  build-plugins --jobs 8 --edition {}'.format(edition),
        ],
    }


def test_backend_step(edition):
    if edition == 'enterprise2':
        return {
            'name': 'test-backend' + enterprise2_suffix(edition),
            'image': build_image,
            'depends_on': [
                'wire-install',
            ],
            'commands': [
                'go test -tags=pro -covermode=atomic -timeout=30m ./pkg/...',
            ],
        }
    else:
        return {
            'name': 'test-backend' + enterprise2_suffix(edition),
            'image': build_image,
            'depends_on': [
                'wire-install',
            ],
            'commands': [
                'go test -short -covermode=atomic -timeout=30m ./pkg/...',
            ],
        }



def test_backend_integration_step(edition):
    return {
        'name': 'test-backend-integration',
        'image': build_image,
        'depends_on': [
            'wire-install',
        ],
        'commands': [
            'go test -run Integration -covermode=atomic -timeout=30m ./pkg/...',
        ],
    }

def betterer_frontend_step():
    return {
        'name': 'betterer-frontend',
        'image': build_image,
        'depends_on': [
            'yarn-install',
        ],
        'commands': [
            'yarn betterer ci',
        ],
        'failure': 'ignore',
    }



def test_frontend_step():
    return {
        'name': 'test-frontend',
        'image': build_image,
        'environment': {
            'TEST_MAX_WORKERS': '50%',
        },
        'depends_on': [
            'yarn-install',
        ],
        'commands': [
            'yarn run ci:test-frontend',
        ],
    }


def lint_frontend_step():
    return {
        'name': 'lint-frontend',
        'image': build_image,
        'environment': {
            'TEST_MAX_WORKERS': '50%',
        },
        'depends_on': [
            'yarn-install',
        ],
        'commands': [
            'yarn run prettier:check',
            'yarn run lint',
            'yarn run i18n:compile',  # TODO: right place for this?
            'yarn run typecheck',
        ],
    }


def test_a11y_frontend_step(ver_mode, edition, port=3001):
    commands = [
        'yarn wait-on http://$HOST:$PORT',
    ]
    failure = 'ignore'
    if ver_mode == 'pr':
        commands.extend([
            'pa11y-ci --config .pa11yci-pr.conf.js',
        ])
        failure = 'always'
    else:
        commands.extend([
            'pa11y-ci --config .pa11yci.conf.js --json > pa11y-ci-results.json',
        ])

    return {
        'name': 'test-a11y-frontend' + enterprise2_suffix(edition),
        'image': 'grafana/docker-puppeteer:1.1.0',
        'depends_on': [
            'grafana-server' + enterprise2_suffix(edition),
        ],
        'environment': {
            'GRAFANA_MISC_STATS_API_KEY': from_secret('grafana_misc_stats_api_key'),
            'HOST': 'grafana-server' + enterprise2_suffix(edition),
            'PORT': port,
        },
        'failure': failure,
        'commands': commands,
    }


def frontend_metrics_step(edition, trigger=None):
    if edition in ('enterprise', 'enterprise2'):
        return None

    step = {
        'name': 'publish-frontend-metrics',
        'image': build_image,
        'depends_on': [
            'test-a11y-frontend' + enterprise2_suffix(edition),
        ],
        'environment': {
            'GRAFANA_MISC_STATS_API_KEY': from_secret('grafana_misc_stats_api_key'),
        },
        'failure': 'ignore',
        'commands': [
            './scripts/ci-frontend-metrics.sh | ./bin/build publish-metrics $${GRAFANA_MISC_STATS_API_KEY}',
        ],
    }
    if trigger:
        step = dict(step, when=trigger)
    return step


def codespell_step():
    return {
        'name': 'codespell',
        'image': build_image,
        'commands': [
            # Important: all words have to be in lowercase, and separated by "\n".
            'echo -e "unknwon\nreferer\nerrorstring\neror\niam\nwan" > words_to_ignore.txt',
            'codespell -I words_to_ignore.txt docs/',
            'rm words_to_ignore.txt',
        ],
    }


def shellcheck_step():
    return {
        'name': 'shellcheck',
        'image': build_image,
        'depends_on': [
            'grabpl',
            'compile-build-cmd',
        ],
        'commands': [
            './bin/build shellcheck',
        ],
    }


def package_step(edition, ver_mode, include_enterprise2=False, variants=None):
    deps = [
        'build-plugins',
        'build-backend',
        'build-frontend',
        'build-frontend-packages',
    ]
    if include_enterprise2:
        sfx = '-enterprise2'
        deps.extend([
            'build-backend' + sfx,
        ])

    variants_str = ''
    if variants:
        variants_str = ' --variants {}'.format(','.join(variants))

    if ver_mode in ('main', 'release', 'release-branch'):
        sign_args = ' --sign'
        env = {
            'GRAFANA_API_KEY': from_secret('grafana_api_key'),
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
            '{} ${{DRONE_TAG}}'.format(
                sign_args
            ),
        ]
    else:
        build_no = '${DRONE_BUILD_NUMBER}'
        cmds = [
            '{}./bin/grabpl package --jobs 8 --edition {} '.format(test_args, edition) + \
            '--build-id {}{}{}'.format(build_no, variants_str, sign_args),
        ]

    return {
        'name': 'package' + enterprise2_suffix(edition),
        'image': build_image,
        'depends_on': deps,
        'environment': env,
        'commands': cmds,
    }


def grafana_server_step(edition, port=3001):
    package_file_pfx = ''
    if edition == 'enterprise2':
        package_file_pfx = 'grafana' + enterprise2_suffix(edition)
    elif edition == 'enterprise':
        package_file_pfx = 'grafana-' + edition

    environment = {
        'PORT': port,
        'ARCH': 'linux-amd64'
    }
    if package_file_pfx:
        environment['RUNDIR'] = 'scripts/grafana-server/tmp-{}'.format(package_file_pfx)

    return {
        'name': 'grafana-server' + enterprise2_suffix(edition),
        'image': build_image,
        'detach': True,
        'depends_on': [
            'build-plugins',
            'build-backend',
            'build-frontend',
            'build-frontend-packages',
        ],
        'environment': environment,
        'commands': [
            './scripts/grafana-server/start-server',
        ],
    }


def e2e_tests_step(suite, edition, port=3001, tries=None):
    cmd = './bin/build e2e-tests --port {} --suite {}'.format(port, suite)
    if tries:
        cmd += ' --tries {}'.format(tries)
    return {
        'name': 'end-to-end-tests-{}'.format(suite) + enterprise2_suffix(edition),
        'image': 'cypress/included:9.5.1-node16.14.0-slim-chrome99-ff97',
        'depends_on': [
            'grafana-server',
        ],
        'environment': {
            'HOST': 'grafana-server' + enterprise2_suffix(edition),
        },
        'commands': [
            'apt-get install -y netcat',
            cmd,
        ],
    }


def build_docs_website_step():
    return {
        'name': 'build-docs-website',
        # Use latest revision here, since we want to catch if it breaks
        'image': 'grafana/docs-base:latest',
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
    cmd = './bin/build build-docker --edition {}'.format(edition)
    if publish:
        cmd += ' --shouldSave'

    ubuntu_sfx = ''
    if ubuntu:
        ubuntu_sfx = '-ubuntu'
        cmd += ' --ubuntu'

    if archs:
        cmd += ' -archs {}'.format(','.join(archs))

    return {
        'name': 'build-docker-images' + ubuntu_sfx,
        'image': 'google/cloud-sdk',
        'depends_on': [
          'copy-packages-for-docker',
          'compile-build-cmd',
        ],
        'commands': [
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


def publish_images_step(edition, ver_mode, mode, docker_repo, trigger=None):
    if mode == 'security':
        mode = '--{} '.format(mode)
    else:
        mode = ''

    cmd = './bin/grabpl artifacts docker publish {}--dockerhub-repo {} --base alpine --base ubuntu --arch amd64 --arch arm64 --arch armv7'.format(
        mode, docker_repo)

    if ver_mode == 'release':
        deps = ['fetch-images-{}'.format(edition)]
        cmd += ' --version-tag ${TAG}'
    else:
        deps = ['build-docker-images', 'build-docker-images-ubuntu']

    step = {
        'name': 'publish-images-{}'.format(docker_repo),
        'image': 'google/cloud-sdk',
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
            'DOCKER_USER': from_secret('docker_username'),
            'DOCKER_PASSWORD': from_secret('docker_password'),
        },
        'commands': [cmd],
        'depends_on': deps,
        'volumes': [{
            'name': 'docker',
            'path': '/var/run/docker.sock'
        }],
    }
    if trigger and ver_mode in ("release-branch", "main"):
        step = dict(step, when=trigger)

    return step


def postgres_integration_tests_step(edition, ver_mode):
    cmds = [
            'apt-get update',
            'apt-get install -yq postgresql-client',
            'dockerize -wait tcp://postgres:5432 -timeout 120s',
            'psql -p 5432 -h postgres -U grafanatest -d grafanatest -f ' +
            'devenv/docker/blocks/postgres_tests/setup.sql',
            # Make sure that we don't use cached results for another database
            'go clean -testcache',
            "go list './pkg/...' | xargs -I {} sh -c 'go test -run Integration -covermode=atomic -timeout=30m {}'",
        ]
    return {
        'name': 'postgres-integration-tests',
        'image': build_image,
        'depends_on': ['wire-install'],
        'environment': {
            'PGPASSWORD': 'grafanatest',
            'GRAFANA_TEST_DB': 'postgres',
            'POSTGRES_HOST': 'postgres',
        },
        'commands': cmds,
    }


def mysql_integration_tests_step(edition, ver_mode):
    cmds = [
            'apt-get update',
            'apt-get install -yq default-mysql-client',
            'dockerize -wait tcp://mysql:3306 -timeout 120s',
            'cat devenv/docker/blocks/mysql_tests/setup.sql | mysql -h mysql -P 3306 -u root -prootpass',
            # Make sure that we don't use cached results for another database
            'go clean -testcache',
            "go list './pkg/...' | xargs -I {} sh -c 'go test -run Integration -covermode=atomic -timeout=30m {}'",
        ]
    return {
        'name': 'mysql-integration-tests',
        'image': build_image,
        'depends_on': ['wire-install'],
        'environment': {
            'GRAFANA_TEST_DB': 'mysql',
            'MYSQL_HOST': 'mysql',
        },
        'commands': cmds,
    }


def redis_integration_tests_step():
    return {
        'name': 'redis-integration-tests',
        'image': build_image,
        'depends_on': ['wire-install'],
        'environment': {
            'REDIS_URL': 'redis://redis:6379/0',
        },
        'commands': [
            'dockerize -wait tcp://redis:6379/0 -timeout 120s',
            './bin/grabpl integration-tests',
        ],
    }


def memcached_integration_tests_step():
    return {
        'name': 'memcached-integration-tests',
        'image': build_image,
        'depends_on': ['wire-install'],
        'environment': {
            'MEMCACHED_HOSTS': 'memcached:11211',
        },
        'commands': [
            'dockerize -wait tcp://memcached:11211 -timeout 120s',
            './bin/grabpl integration-tests',
        ],
    }


def release_canary_npm_packages_step(edition, trigger=None):
    if edition in ('enterprise', 'enterprise2'):
        return None

    step = {
        'name': 'release-canary-npm-packages',
        'image': build_image,
        'depends_on': end_to_end_tests_deps(edition),
        'environment': {
            'NPM_TOKEN': from_secret('npm_token'),
        },
        'commands': [
            './scripts/circle-release-canary-packages.sh',
        ],
    }
    if trigger:
        step = dict(step, when=trigger)
    return step


def enterprise2_suffix(edition):
    if edition == 'enterprise2':
        return '-{}'.format(edition)
    return ''


def upload_packages_step(edition, ver_mode, trigger=None):
    if ver_mode == 'main' and edition in ('enterprise', 'enterprise2'):
        return None

    deps = []
    if edition in 'enterprise2' or not end_to_end_tests_deps(edition):
        deps.extend([
            'package' + enterprise2_suffix(edition),
        ])
    else:
        deps.extend(end_to_end_tests_deps(edition))

    step = {
        'name': 'upload-packages' + enterprise2_suffix(edition),
        'image': publish_image,
        'depends_on': deps,
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
            'PRERELEASE_BUCKET': from_secret('prerelease_bucket'),
        },
        'commands': ['./bin/grabpl upload-packages --edition {}'.format(edition),],
    }
    if trigger and ver_mode in ("release-branch", "main"):
        step = dict(step, when=trigger)
    return step


def publish_packages_step(edition, ver_mode):
    if ver_mode == 'release':
        cmd = './bin/grabpl publish packages --edition {} --gcp-key /tmp/gcpkey.json ${{DRONE_TAG}}'.format(
            edition,
        )
    elif ver_mode == 'main':
        build_no = '${DRONE_BUILD_NUMBER}'
        cmd = './bin/grabpl publish packages --edition {} --gcp-key /tmp/gcpkey.json --build-id {}'.format(
            edition, build_no,
        )
    else:
        fail('Unexpected version mode {}'.format(ver_mode))

    return {
        'name': 'publish-packages-{}'.format(edition),
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
            cmd,
        ],
    }

def publish_grafanacom_step(edition, ver_mode):
    if ver_mode == 'release':
        cmd = './bin/grabpl publish grafana-com --edition {} ${{DRONE_TAG}}'.format(
            edition,
        )
    elif ver_mode == 'main':
        build_no = '${DRONE_BUILD_NUMBER}'
        cmd = './bin/grabpl publish grafana-com --edition {} --build-id {}'.format(
            edition, build_no,
        )
    else:
        fail('Unexpected version mode {}'.format(ver_mode))

    return {
        'name': 'publish-grafanacom-{}'.format(edition),
        'image': publish_image,
        'depends_on': [
            'publish-packages-{}'.format(edition),
        ],
        'environment': {
            'GRAFANA_COM_API_KEY': from_secret('grafana_api_key'),
        },
        'commands': [
            cmd,
        ],
    }

def publish_linux_packages_step(edition):
    return {
        'name': 'publish-linux-packages',
        # See https://github.com/grafana/deployment_tools/blob/master/docker/package-publish/README.md for docs on that image
        'image': 'us.gcr.io/kubernetes-dev/package-publish:latest',
        'depends_on': [
            'grabpl'
        ],
        'failure': 'ignore', # While we're testing it
        'settings': {
            'access_key_id': from_secret('packages_access_key_id'),
            'secret_access_key': from_secret('packages_secret_access_key'),
            'service_account_json': from_secret('packages_service_account_json'),
            'target_bucket': 'grafana-packages',
            'deb_distribution': 'stable',
            'gpg_passphrase': from_secret('packages_gpg_passphrase'),
            'gpg_public_key': from_secret('packages_gpg_public_key'),
            'gpg_private_key': from_secret('packages_gpg_private_key'),
            'package_path': 'gs://grafana-prerelease/artifacts/downloads/*${{DRONE_TAG}}/{}/**.deb'.format(edition)
        }
    }


def get_windows_steps(edition, ver_mode):
    init_cmds = []
    sfx = ''
    if edition in ('enterprise', 'enterprise2'):
        sfx = '-{}'.format(edition)
    else:
        init_cmds.extend([
            '$$ProgressPreference = "SilentlyContinue"',
            'Invoke-WebRequest https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/{}/windows/grabpl.exe -OutFile grabpl.exe'.format(
                grabpl_version),
        ])
    steps = [
        {
            'name': 'windows-init',
            'image': wix_image,
            'commands': init_cmds,
        },
    ]
    if (ver_mode == 'main' and (edition not in ('enterprise', 'enterprise2'))) or ver_mode in (
        'release', 'release-branch',
    ):
        bucket = '%PRERELEASE_BUCKET%/artifacts/downloads'
        if ver_mode == 'release':
            ver_part = '${DRONE_TAG}'
            dir = 'release'
        else:
            dir = 'main'
            bucket = 'grafana-downloads'
            build_no = 'DRONE_BUILD_NUMBER'
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
        if (ver_mode == 'main' and (edition not in ('enterprise', 'enterprise2'))) or ver_mode in (
            'release',
        ):
            installer_commands.extend([
                '.\\grabpl.exe windows-installer --edition {} {}'.format(edition, ver_part),
                '$$fname = ((Get-Childitem grafana*.msi -name) -split "`n")[0]',
            ])
            if ver_mode == 'main':
                installer_commands.extend([
                    'gsutil cp $$fname gs://{}/{}/{}/'.format(bucket, edition, dir),
                    'gsutil cp "$$fname.sha256" gs://{}/{}/{}/'.format(bucket, edition, dir),
                ])
            else:
                installer_commands.extend([
                    'gsutil cp $$fname gs://{}/{}/{}/{}/'.format(bucket, ver_part, edition, dir),
                    'gsutil cp "$$fname.sha256" gs://{}/{}/{}/{}/'.format(bucket, ver_part, edition, dir),
                ])
        steps.append({
            'name': 'build-windows-installer',
            'image': wix_image,
            'depends_on': [
                'windows-init',
            ],
            'environment': {
                'GCP_KEY': from_secret('gcp_key'),
                'PRERELEASE_BUCKET': from_secret(prerelease_bucket),
                'GITHUB_TOKEN': from_secret('github_token')
            },
            'commands': installer_commands,
        })

    if edition in ('enterprise', 'enterprise2'):
        if ver_mode == 'release':
            committish = '${DRONE_TAG}'
        elif ver_mode == 'release-branch':
            committish = '$$env:DRONE_BRANCH'
        else:
            committish = '$$env:DRONE_COMMIT'
        # For enterprise, we have to clone both OSS and enterprise and merge the latter into the former
        download_grabpl_step_cmds = [
            '$$ProgressPreference = "SilentlyContinue"',
            'Invoke-WebRequest https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/{}/windows/grabpl.exe -OutFile grabpl.exe'.format(
                grabpl_version),
        ]
        clone_cmds = [
            'git clone "https://$$env:GITHUB_TOKEN@github.com/grafana/grafana-enterprise.git"',
        ]
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
            'commands': download_grabpl_step_cmds + clone_cmds,
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
            'C:\\App\\grabpl.exe init-enterprise --github-token $$env:GITHUB_TOKEN C:\\App\\grafana-enterprise',
            'cp C:\\App\\grabpl.exe grabpl.exe',
        ])
        if 'environment' in steps[1]:
            steps[1]['environment'] + {'GITHUB_TOKEN': from_secret(github_token)}
        else:
            steps[1]['environment'] = {'GITHUB_TOKEN': from_secret(github_token)}

    return steps

def verify_gen_cue_step(edition):
    deps = []
    if edition == "enterprise":
        deps.extend(['init-enterprise'])
    return {
        'name': 'verify-gen-cue',
        'image': build_image,
        'depends_on': deps,
        'commands': [
            '# It is required that code generated from Thema/CUE be committed and in sync with its inputs.',
            '# The following command will fail if running code generators produces any diff in output.',
            'CODEGEN_VERIFY=1 make gen-cue',
        ],
    }

def trigger_test_release():
    return {
        'name': 'trigger-test-release',
        'image': build_image,
        'environment': {
            'GITHUB_TOKEN': from_secret('github_token'),
            'DOWNSTREAM_REPO': from_secret('downstream'),
            'TEST_TAG': 'v0.0.0-test',
        },
        'commands': [
            'git clone "https://$${GITHUB_TOKEN}@github.com/grafana/grafana-enterprise.git" --depth=1',
            'cd grafana-enterprise',
            'git fetch origin "refs/tags/*:refs/tags/*"',
            'git tag -d $${TEST_TAG} && git push --delete origin $${TEST_TAG} && git tag $${TEST_TAG} && git push origin $${TEST_TAG}',
            'cd -',
            'git fetch origin "refs/tags/*:refs/tags/*"',
            'git remote add downstream https://$${GITHUB_TOKEN}@github.com/grafana/$${DOWNSTREAM_REPO}.git',
            'git tag -d $${TEST_TAG} && git push --delete downstream --quiet $${TEST_TAG} && git tag $${TEST_TAG} && git push downstream $${TEST_TAG} --quiet',
        ],
        'failure': 'ignore',
        'when': {
            'paths': {
                'include': [
                    '.drone.yml',
                    'pkg/build/**',
                ]
            },
            'repo': [
                'grafana/grafana',
            ]
        }
    }

def artifacts_page_step():
    return {
        'name': 'artifacts-page',
        'image': build_image,
        'depends_on': [
            'grabpl',
        ],
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
        },
        'commands': [
            './bin/grabpl artifacts-page',
        ],
    }

def end_to_end_tests_deps(edition):
    if disable_tests:
        return []
    return [
        'end-to-end-tests-dashboards-suite' + enterprise2_suffix(edition),
        'end-to-end-tests-panels-suite' + enterprise2_suffix(edition),
        'end-to-end-tests-smoke-tests-suite' + enterprise2_suffix(edition),
        'end-to-end-tests-various-suite' + enterprise2_suffix(edition),
    ]

def compile_build_cmd(edition='oss'):
    dependencies = []
    if edition == 'enterprise':
          dependencies = ['init-enterprise',]
    return {
        'name': 'compile-build-cmd',
        'image': go_image,
        'commands': [
            "go build -o ./bin/build -ldflags '-extldflags -static' ./pkg/build/cmd",
        ],
        'depends_on': dependencies,
        'environment': {
            'CGO_ENABLED': 0,
    },
}
