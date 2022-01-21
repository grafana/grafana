load(
    'scripts/drone/steps/lib.star',
    'disable_tests',
    'download_grabpl_step',
    'initialize_step',
    'lint_drone_step',
    'test_release_ver',
    'build_image',
    'publish_image',
    'lint_backend_step',
    'lint_frontend_step',
    'codespell_step',
    'shellcheck_step',
    'test_backend_step',
    'test_backend_integration_step',
    'test_frontend_step',
    'build_backend_step',
    'build_frontend_step',
    'build_plugins_step',
    'package_step',
    'e2e_tests_server_step',
    'e2e_tests_step',
    'e2e_tests_artifacts',
    'build_storybook_step',
    'copy_packages_for_docker_step',
    'package_docker_images_step',
    'postgres_integration_tests_step',
    'mysql_integration_tests_step',
    'redis_integration_tests_step',
    'memcached_integration_tests_step',
    'get_windows_steps',
    'benchmark_ldap_step',
    'frontend_metrics_step',
    'store_storybook_step',
    'upload_packages_step',
    'store_packages_step',
    'upload_cdn_step',
    'validate_scuemata_step',
    'ensure_cuetsified_step'
)

load(
    'scripts/drone/services/services.star',
    'integration_test_services',
    'integration_test_services_volumes',
    'ldap_service',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
    'notify_pipeline',
    'failure_template',
    'drone_change_template',
)
load('scripts/drone/vault.star', 'from_secret', 'github_token', 'pull_secret', 'drone_token', 'prerelease_bucket')


def build_npm_packages_step(edition, ver_mode):
    if edition == 'enterprise' or ver_mode != 'release':
        return None

    return {
        'name': 'build-npm-packages',
        'image': build_image,
        'depends_on': [
            # Has to run after store-storybook since this step cleans the files publish-storybook depends on
            'store-storybook',
        ],
        'commands': ['./scripts/build/build-npm-packages.sh ${DRONE_TAG}'],
    }

def store_npm_packages_step():
    return {
        'name': 'store-npm-packages',
        'image': publish_image,
        'depends_on': [
            'build-npm-packages',
        ],
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
            'PRERELEASE_BUCKET': from_secret(prerelease_bucket)
        },
        'commands': [
            './bin/grabpl artifacts npm store --tag ${DRONE_TAG}'
        ],
    }

def retrieve_npm_packages_step():
    return {
        'name': 'retrieve-npm-packages',
        'image': publish_image,
        'depends_on': [
            'initialize',
        ],
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
            'PRERELEASE_BUCKET': from_secret(prerelease_bucket)
        },
        'commands': [
            './bin/grabpl artifacts npm retrieve --tag v${TAG}'
        ],
    }

def release_npm_packages_step():
    return {
        'name': 'release-npm-packages',
        'image': build_image,
        'depends_on': [
            'retrieve-npm-packages',
        ],
        'environment': {
            'NPM_TOKEN': from_secret('npm_token'),
        },
        'commands': [
            './bin/grabpl artifacts npm release --tag v${TAG}'
        ],
    }

def publish_images_step(edition, mode, docker_repo):
    if mode == 'security':
        mode = '--{} '.format(mode)
    else:
        mode = ''
    return {
        'name': 'publish-images-{}'.format(docker_repo),
        'image': 'google/cloud-sdk',
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
            'DOCKER_USER': from_secret('docker_username'),
            'DOCKER_PASSWORD': from_secret('docker_password'),
        },
        'commands': ['./bin/grabpl artifacts docker publish {}--version-tag ${{TAG}} --dockerhub-repo {} --base alpine --base ubuntu --arch amd64 --arch arm64 --arch armv7'.format(mode, docker_repo)],
        'depends_on': ['fetch-images-{}'.format(edition)],
        'volumes': [{
            'name': 'docker',
            'path': '/var/run/docker.sock'
        }],
    }

def fetch_images_step(edition):
    return {
        'name': 'fetch-images-{}'.format(edition),
        'image': 'google/cloud-sdk',
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
            'DOCKER_USER': from_secret('docker_username'),
            'DOCKER_PASSWORD': from_secret('docker_password'),
        },
        'commands': ['./bin/grabpl artifacts docker fetch --version-tag ${{TAG}} --edition {} --base alpine --base ubuntu --arch amd64 --arch arm64 --arch armv7'.format(edition)],
        'depends_on': ['grabpl'],
        'volumes': [{
            'name': 'docker',
            'path': '/var/run/docker.sock'
        }],
    }

def publish_image_steps(version, mode, docker_repo, additional_docker_repo=""):
    steps = [
        download_grabpl_step(),
        fetch_images_step(version),
        publish_images_step(version, mode, docker_repo),
    ]
    if additional_docker_repo != "":
        steps.extend([publish_images_step(version, mode, additional_docker_repo)])

    return steps

def publish_image_pipelines(mode):
    trigger = {
        'event': ['promote'],
        'target': [mode],
    }

    return [pipeline(
        name='publish-docker-oss-{}'.format(mode), trigger=trigger, steps=publish_image_steps(version='oss',  mode=mode, docker_repo='grafana', additional_docker_repo='grafana-oss'), edition=""
    ), pipeline(
        name='publish-docker-enterprise-{}'.format(mode), trigger=trigger, steps=publish_image_steps(version='enterprise',  mode=mode, docker_repo='grafana-enterprise'), edition=""
    ),]

def get_steps(edition, ver_mode):
    package_steps = []
    publish_steps = []
    should_publish = ver_mode == 'release'
    should_upload = should_publish or ver_mode in ('release-branch',)
    include_enterprise2 = edition == 'enterprise'
    edition2 = 'enterprise2'

    test_steps = [
        codespell_step(),
        shellcheck_step(),
        lint_backend_step(edition=edition),
        lint_frontend_step(),
        test_backend_step(edition=edition),
        test_backend_integration_step(edition=edition),
        test_frontend_step(),
    ]

    build_steps = [
        build_backend_step(edition=edition, ver_mode=ver_mode),
        build_frontend_step(edition=edition, ver_mode=ver_mode),
        build_plugins_step(edition=edition, sign=True),
        validate_scuemata_step(),
        ensure_cuetsified_step(),
    ]

    integration_test_steps = [
        postgres_integration_tests_step(edition=edition, ver_mode=ver_mode),
        mysql_integration_tests_step(edition=edition, ver_mode=ver_mode),
    ]


    if include_enterprise2:
        test_steps.extend([
            lint_backend_step(edition=edition2),
            test_backend_step(edition=edition2),
            test_backend_integration_step(edition=edition2),
        ])
        build_steps.extend([
            build_backend_step(edition=edition2, ver_mode=ver_mode, variants=['linux-x64']),
        ])

    # Insert remaining steps
    build_steps.extend([
        package_step(edition=edition, ver_mode=ver_mode, include_enterprise2=include_enterprise2),
        copy_packages_for_docker_step(),
        package_docker_images_step(edition=edition, ver_mode=ver_mode, publish=should_publish),
        package_docker_images_step(edition=edition, ver_mode=ver_mode, ubuntu=True, publish=should_publish),
        e2e_tests_server_step(edition=edition),
    ])

    if not disable_tests:
        build_steps.extend([
            e2e_tests_step('dashboards-suite', edition=edition, tries=3),
            e2e_tests_step('smoke-tests-suite', edition=edition, tries=3),
            e2e_tests_step('panels-suite', edition=edition, tries=3),
            e2e_tests_step('various-suite', edition=edition, tries=3),
            e2e_tests_artifacts(edition=edition),
        ])

    build_storybook = build_storybook_step(edition=edition, ver_mode=ver_mode)
    if build_storybook:
        build_steps.append(build_storybook)

    if include_enterprise2:
      integration_test_steps.extend([redis_integration_tests_step(edition=edition2, ver_mode=ver_mode), memcached_integration_tests_step(edition=edition2, ver_mode=ver_mode)])

    if should_upload:
        publish_steps.append(upload_cdn_step(edition=edition, ver_mode=ver_mode))
        publish_steps.append(upload_packages_step(edition=edition, ver_mode=ver_mode))
    if should_publish:
        publish_step = store_storybook_step(edition=edition, ver_mode=ver_mode)
        build_npm_step = build_npm_packages_step(edition=edition, ver_mode=ver_mode)
        store_npm_step = store_npm_packages_step()
        if publish_step:
            publish_steps.append(publish_step)
        if build_npm_step and store_npm_step:
            publish_steps.append(build_npm_step)
            publish_steps.append(store_npm_step)
    windows_package_steps = get_windows_steps(edition=edition, ver_mode=ver_mode)

    if include_enterprise2:
        publish_steps.extend([
            package_step(edition=edition2, ver_mode=ver_mode, include_enterprise2=include_enterprise2, variants=['linux-x64']),
            upload_cdn_step(edition=edition2, ver_mode=ver_mode),
        ])
        if should_upload:
            step = upload_packages_step(edition=edition2, ver_mode=ver_mode)
            if step:
                publish_steps.append(step)

    return test_steps, build_steps, integration_test_steps, package_steps, windows_package_steps, publish_steps

def get_oss_pipelines(trigger, ver_mode):
    edition = 'oss'
    services = integration_test_services(edition=edition)
    volumes = integration_test_services_volumes()
    test_steps, build_steps, integration_test_steps, package_steps, windows_package_steps, publish_steps = get_steps(edition=edition, ver_mode=ver_mode)
    windows_pipeline = pipeline(
        name='oss-windows-{}'.format(ver_mode), edition=edition, trigger=trigger,
        steps=initialize_step(edition, platform='windows', ver_mode=ver_mode) + windows_package_steps,
        platform='windows', depends_on=[
            'oss-build{}-publish-{}'.format(get_e2e_suffix(), ver_mode),
        ],
    )
    pipelines = [
        pipeline(
            name='oss-build-publish{}-{}'.format(get_e2e_suffix(), ver_mode), edition=edition, trigger=trigger, services=[],
            steps=[download_grabpl_step()] + initialize_step(edition, platform='linux', ver_mode=ver_mode) +
                  build_steps + package_steps + publish_steps,
            volumes=volumes,
        ),
    ]
    if not disable_tests:
        pipelines.extend([
            pipeline(
                name='oss-test-{}'.format(ver_mode), edition=edition, trigger=trigger, services=[],
                steps=[download_grabpl_step()] + initialize_step(edition, platform='linux', ver_mode=ver_mode) +
                  test_steps,
                volumes=[],
            ),
            pipeline(
                name='oss-integration-tests-{}'.format(ver_mode), edition=edition, trigger=trigger, services=services,
                steps=[download_grabpl_step()] + initialize_step(edition, platform='linux', ver_mode=ver_mode) +
                      integration_test_steps,
                volumes=volumes,
            )
        ])
        deps = {
            'depends_on': [
                'oss-build-publish{}-{}'.format(get_e2e_suffix(), ver_mode),
                'oss-test-{}'.format(ver_mode),
                'oss-integration-tests-{}'.format(ver_mode)
            ]
        }
        windows_pipeline.update(deps)

    pipelines.extend([windows_pipeline])
    return pipelines

def get_enterprise_pipelines(trigger, ver_mode):
    edition = 'enterprise'
    services = integration_test_services(edition=edition)
    volumes = integration_test_services_volumes()
    test_steps, build_steps, integration_test_steps, package_steps, windows_package_steps, publish_steps = get_steps(edition=edition, ver_mode=ver_mode)
    windows_pipeline = pipeline(
        name='enterprise-windows-{}'.format(ver_mode), edition=edition, trigger=trigger,
        steps=initialize_step(edition, platform='windows', ver_mode=ver_mode) + windows_package_steps,
        platform='windows', depends_on=[
            'enterprise-build{}-publish-{}'.format(get_e2e_suffix(), ver_mode),
        ],
    )
    pipelines = [
        pipeline(
            name='enterprise-build{}-publish-{}'.format(get_e2e_suffix(), ver_mode), edition=edition, trigger=trigger, services=[],
            steps=[download_grabpl_step()] + initialize_step(edition, platform='linux', ver_mode=ver_mode) +
                  build_steps + package_steps + publish_steps,
            volumes=volumes,
        ),
    ]
    if not disable_tests:
        pipelines.extend([
            pipeline(
                name='enterprise-test-{}'.format(ver_mode), edition=edition, trigger=trigger, services=[],
                steps=[download_grabpl_step()] + initialize_step(edition, platform='linux', ver_mode=ver_mode) +
                  test_steps,
                volumes=[],
            ),
            pipeline(
                name='enterprise-integration-tests-{}'.format(ver_mode), edition=edition, trigger=trigger, services=services,
                steps=[download_grabpl_step()] + initialize_step(edition, platform='linux', ver_mode=ver_mode) +
                      integration_test_steps,
                volumes=volumes,
            ),
        ])
        deps = {
            'depends_on': [
                'enterprise-build{}-publish-{}'.format(get_e2e_suffix(), ver_mode),
                'enterprise-test-{}'.format(ver_mode),
                'enterprise-integration-tests-{}'.format(ver_mode)
            ]
        }
        windows_pipeline.update(deps)

    pipelines.extend([windows_pipeline])

    return pipelines

def publish_artifacts_step(mode):
    security = ''
    if mode == 'security':
        security = '--security '
    return {
        'name': 'publish-artifacts',
        'image': publish_image,
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
        },
        'commands': ['./bin/grabpl artifacts publish {}--tag ${{TAG}} --src-bucket grafana-prerelease'.format(security)],
        'depends_on': ['grabpl'],
    }

def publish_packages_step(edition):
    return {
        'name': 'publish-packages-{}'.format(edition),
        'image': publish_image,
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
        },
        'commands': ['./bin/grabpl store-packages {}'.format(edition)],
        'depends_on': ['grabpl'],
    }

def publish_artifacts_pipelines(mode):
    trigger = {
        'event': ['promote'],
        'target': [mode],
    }
    steps = [
        download_grabpl_step(),
        publish_artifacts_step(mode),
    ]

    return [pipeline(
        name='publish-artifacts-{}'.format(mode), trigger=trigger, steps=steps, edition="all"
    )]

def publish_packages_pipeline():
    trigger = {
        'event': ['promote'],
        'target': ['public'],
    }
    steps = [
        download_grabpl_step(),
        store_packages_step(edition='oss', ver_mode='release'),
        store_packages_step(edition='enterprise', ver_mode='release'),
    ]

    return [pipeline(
        name='publish-packages', trigger=trigger, steps=steps, edition="all", depends_on=['publish-artifacts-public']
    )]

def publish_npm_pipelines(mode):
    trigger = {
        'event': ['promote'],
        'target': [mode],
    }
    steps = [
        download_grabpl_step(),
        retrieve_npm_packages_step(),
        release_npm_packages_step()
    ]

    return [pipeline(
        name='publish-npm-packages-{}'.format(mode), trigger=trigger, steps = initialize_step(edition='oss', platform='linux', ver_mode='release') + steps, edition="all"
    )]

def release_pipelines(ver_mode='release', trigger=None, environment=None):
    # 'enterprise' edition services contain both OSS and enterprise services
    services = integration_test_services(edition='enterprise')
    if not trigger:
        trigger = {
            'event': {
                'exclude': [
                    'promote'
                ]
            },
            'ref': ['refs/tags/v*',],
            'repo': {
              'exclude': ['grafana/grafana'],
            },
        }

    should_publish = ver_mode == 'release'

    # The release pipelines include also enterprise ones, so both editions are built for a release.
    # We could also solve this by triggering a downstream build for the enterprise repo, but by including enterprise
    # in OSS release builds, we simplify the UX for the release engineer.
    oss_pipelines = get_oss_pipelines(ver_mode=ver_mode, trigger=trigger)
    enterprise_pipelines = get_enterprise_pipelines(ver_mode=ver_mode, trigger=trigger)

    pipelines = oss_pipelines + enterprise_pipelines

    # if ver_mode == 'release':
    #   pipelines.append(publish_artifacts_pipelines())
    #pipelines.append(notify_pipeline(
    #    name='notify-{}'.format(ver_mode), slack_channel='grafana-ci-notifications', trigger=dict(trigger, status = ['failure']),
    #    depends_on=[p['name'] for p in pipelines], template=failure_template, secret='slack_webhook',
    #))

    return pipelines

def get_e2e_suffix():
    if not disable_tests:
        return '-e2e'
    return ''
