load(
    'scripts/drone/steps/lib.star',
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
    'build_storybook_step',
    'copy_packages_for_docker_step',
    'build_docker_images_step',
    'postgres_integration_tests_step',
    'mysql_integration_tests_step',
    'redis_integration_tests_step',
    'memcached_integration_tests_step',
    'get_windows_steps',
    'benchmark_ldap_step',
    'frontend_metrics_step',
    'publish_storybook_step',
    'upload_packages_step',
    'publish_packages_step',
    'upload_cdn_step',
    'validate_scuemata_step',
    'ensure_cuetsified_step'
)

load(
    'scripts/drone/services/services.star',
    'integration_test_services',
    'ldap_service',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
    'notify_pipeline',
)

def release_npm_packages_step(edition, ver_mode):
    if edition == 'enterprise':
        return None

    if ver_mode == 'release':
        commands = ['./scripts/build/release-packages.sh ${DRONE_TAG}']
    else:
        commands = []

    return {
        'name': 'release-npm-packages',
        'image': build_image,
        'depends_on': [
            # Has to run after publish-storybook since this step cleans the files publish-storybook depends on
            'publish-storybook',
        ],
        'environment': {
            'NPM_TOKEN': {
                'from_secret': 'npm_token',
            },
            'GITHUB_PACKAGE_TOKEN': {
                'from_secret': 'github_package_token',
            },
        },
        'commands': commands,
    }

def get_steps(edition, ver_mode):
    should_publish = ver_mode in ('release', 'test-release',)
    should_upload = should_publish or ver_mode in ('release-branch',)
    include_enterprise2 = edition == 'enterprise'
    tries = None
    if should_publish:
        tries = 5

    steps = [
        lint_drone_step(),
        codespell_step(),
        shellcheck_step(),
        lint_backend_step(edition=edition),
        lint_frontend_step(),
        test_backend_step(edition=edition),
        test_backend_integration_step(edition=edition),
        test_frontend_step(),
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
        build_backend_step(edition=edition, ver_mode=ver_mode),
        build_frontend_step(edition=edition, ver_mode=ver_mode),
        build_plugins_step(edition=edition, sign=True),
        validate_scuemata_step(),
        ensure_cuetsified_step(),
    ]

    if include_enterprise2:
        edition2 = 'enterprise2'
        steps.extend([
            lint_backend_step(edition=edition2),
            test_backend_step(edition=edition2),
            test_backend_integration_step(edition=edition2),
            build_backend_step(edition=edition2, ver_mode=ver_mode, variants=['linux-x64']),
        ])

    # Insert remaining steps
    steps.extend([
        package_step(edition=edition, ver_mode=ver_mode, include_enterprise2=include_enterprise2),
        e2e_tests_server_step(edition=edition),
        e2e_tests_step(edition=edition, tries=3),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition=edition, ver_mode=ver_mode, publish=should_publish),
        build_docker_images_step(edition=edition, ver_mode=ver_mode, ubuntu=True, publish=should_publish),
    ])

    build_storybook = build_storybook_step(edition=edition, ver_mode=ver_mode)
    if build_storybook:
        steps.append(build_storybook)

    if include_enterprise2:
      steps.extend([redis_integration_tests_step(), memcached_integration_tests_step()])

    if should_upload:
        steps.append(upload_cdn_step(edition=edition))
        steps.append(upload_packages_step(edition=edition, ver_mode=ver_mode))
    if should_publish:
        publish_step = publish_storybook_step(edition=edition, ver_mode=ver_mode)
        release_npm_step = release_npm_packages_step(edition=edition, ver_mode=ver_mode)
        if publish_step:
            steps.append(publish_step)
        if release_npm_step:
            steps.append(release_npm_step)
    windows_steps = get_windows_steps(edition=edition, ver_mode=ver_mode)

    if include_enterprise2:
        edition2 = 'enterprise2'
        steps.extend([
            package_step(edition=edition2, ver_mode=ver_mode, include_enterprise2=include_enterprise2, variants=['linux-x64']),
            e2e_tests_server_step(edition=edition2, port=3002),
            e2e_tests_step(edition=edition2, port=3002, tries=3),
            upload_cdn_step(edition=edition2),
        ])
        if should_upload:
            step = upload_packages_step(edition=edition2, ver_mode=ver_mode)
            if step:
                steps.append(step)

    return steps, windows_steps

def get_oss_pipelines(trigger, ver_mode):
    services = integration_test_services(edition='oss')
    steps, windows_steps = get_steps(edition='oss', ver_mode=ver_mode)
    return [
        pipeline(
            name='oss-build-{}'.format(ver_mode), edition='oss', trigger=trigger, services=services, steps=steps,
            ver_mode=ver_mode,
        ),
        pipeline(
            name='oss-windows-{}'.format(ver_mode), edition='oss', trigger=trigger, steps=windows_steps,
            platform='windows', depends_on=['oss-build-{}'.format(ver_mode)], ver_mode=ver_mode,
        ),
    ]

def get_enterprise_pipelines(trigger, ver_mode):
    services = integration_test_services(edition='enterprise')
    steps, windows_steps = get_steps(edition='enterprise', ver_mode=ver_mode)
    return [
        pipeline(
            name='enterprise-build-{}'.format(ver_mode), edition='enterprise', trigger=trigger, services=services,
            steps=steps, ver_mode=ver_mode,
        ),
        pipeline(
            name='enterprise-windows-{}'.format(ver_mode), edition='enterprise', trigger=trigger, steps=windows_steps,
            platform='windows', depends_on=['enterprise-build-{}'.format(ver_mode)], ver_mode=ver_mode,
        ),
    ]

def release_pipelines(ver_mode='release', trigger=None):
    # 'enterprise' edition services contain both OSS and enterprise services
    services = integration_test_services(edition='enterprise')
    if not trigger:
        trigger = {
            'ref': ['refs/tags/v*',],
        }

    should_publish = ver_mode in ('release', 'test-release',)

    # The release pipelines include also enterprise ones, so both editions are built for a release.
    # We could also solve this by triggering a downstream build for the enterprise repo, but by including enterprise
    # in OSS release builds, we simplify the UX for the release engineer.
    oss_pipelines = get_oss_pipelines(ver_mode=ver_mode, trigger=trigger)
    enterprise_pipelines = get_enterprise_pipelines(ver_mode=ver_mode, trigger=trigger)

    pipelines = oss_pipelines + enterprise_pipelines
    if should_publish:
        publish_pipeline = pipeline(
            name='publish-{}'.format(ver_mode), trigger=trigger, edition='oss', steps=[
                publish_packages_step(edition='oss', ver_mode=ver_mode),
                publish_packages_step(edition='enterprise', ver_mode=ver_mode),
            ], depends_on=[p['name'] for p in oss_pipelines + enterprise_pipelines], install_deps=False,
            ver_mode=ver_mode,
        )
        pipelines.append(publish_pipeline)

    pipelines.append(notify_pipeline(
        name='notify-{}'.format(ver_mode), slack_channel='grafana-ci-notifications', trigger=trigger,
        depends_on=[p['name'] for p in pipelines],
    ))

    return pipelines

def test_release_pipelines():
    ver_mode = 'test-release'

    services = integration_test_services(edition='enterprise')
    trigger = {
        'event': ['custom',],
    }

    oss_pipelines = get_oss_pipelines(ver_mode=ver_mode, trigger=trigger)
    enterprise_pipelines = get_enterprise_pipelines(ver_mode=ver_mode, trigger=trigger)

    publish_cmd = './bin/grabpl publish-packages --edition {{}} --dry-run {}'.format(test_release_ver)

    publish_pipeline = pipeline(
        name='publish-{}'.format(ver_mode), trigger=trigger, edition='oss', steps=[
            publish_packages_step(edition='oss', ver_mode=ver_mode),
            publish_packages_step(edition='enterprise', ver_mode=ver_mode),
        ], depends_on=[p['name'] for p in oss_pipelines + enterprise_pipelines], install_deps=False,
        ver_mode=ver_mode,
    )

    pipelines = oss_pipelines + enterprise_pipelines + [publish_pipeline,]

    pipelines.append(notify_pipeline(
        name='notify-{}'.format(ver_mode), slack_channel='grafana-ci-notifications', trigger=trigger,
        depends_on=[p['name'] for p in pipelines],
    ))

    return pipelines
