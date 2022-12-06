load(
    'scripts/drone/steps/lib.star',
    'clone_enterprise_step',
    'download_grabpl_step',
    'yarn_install_step',
    'wire_install_step',
    'init_enterprise_step',
    'lint_drone_step',
    'build_image',
    'identify_runner_step',
    'publish_image',
    'lint_backend_step',
    'lint_frontend_step',
    'test_backend_step',
    'test_backend_integration_step',
    'test_frontend_step',
    'build_backend_step',
    'build_frontend_step',
    'build_frontend_package_step',
    'build_plugins_step',
    'package_step',
    'grafana_server_step',
    'e2e_tests_step',
    'e2e_tests_artifacts',
    'build_storybook_step',
    'copy_packages_for_docker_step',
    'build_docker_images_step',
    'postgres_integration_tests_step',
    'mysql_integration_tests_step',
    'redis_integration_tests_step',
    'memcached_integration_tests_step',
    'get_windows_steps',
    'benchmark_ldap_step',
    'store_storybook_step',
    'upload_packages_step',
    'publish_grafanacom_step',
    'upload_cdn_step',
    'verify_gen_cue_step',
    'verify_gen_jsonnet_step',
    'publish_images_step',
    'publish_linux_packages_step',
    'trigger_oss',
    'artifacts_page_step',
    'fetch_images_step',
    'compile_build_cmd',
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
    'set_deps',
)

load(
    'scripts/drone/pipelines/test_frontend.star',
    'test_frontend',
)

load(
    'scripts/drone/pipelines/test_backend.star',
    'test_backend',
)

load(
    'scripts/drone/vault.star',
    'from_secret',
    'github_token',
    'pull_secret',
    'drone_token',
    'prerelease_bucket',
)

ver_mode = 'release'
release_trigger = {
    'event': {'exclude': ['promote']},
    'ref': [
        'refs/tags/v*',
    ],
}


def store_npm_packages_step():
    return {
        'name': 'store-npm-packages',
        'image': build_image,
        'depends_on': [
            'build-frontend-packages',
        ],
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
            'PRERELEASE_BUCKET': from_secret(prerelease_bucket),
        },
        'commands': ['./bin/grabpl artifacts npm store --tag ${DRONE_TAG}'],
    }


def retrieve_npm_packages_step():
    return {
        'name': 'retrieve-npm-packages',
        'image': publish_image,
        'depends_on': [
            'yarn-install',
        ],
        'failure': 'ignore',
        'environment': {
            'GCP_KEY': from_secret('gcp_key'),
            'PRERELEASE_BUCKET': from_secret(prerelease_bucket),
        },
        'commands': ['./bin/grabpl artifacts npm retrieve --tag ${DRONE_TAG}'],
    }


def release_npm_packages_step():
    return {
        'name': 'release-npm-packages',
        'image': build_image,
        'depends_on': [
            'retrieve-npm-packages',
        ],
        'failure': 'ignore',
        'environment': {
            'NPM_TOKEN': from_secret('npm_token'),
        },
        'commands': ['./bin/grabpl artifacts npm release --tag ${DRONE_TAG}'],
    }


def oss_pipelines(ver_mode=ver_mode, trigger=release_trigger):
    if ver_mode == 'release':
        committish = '${DRONE_TAG}'
    elif ver_mode == 'release-branch':
        committish = '${DRONE_BRANCH}'
    else:
        committish = '${DRONE_COMMIT}'
    environment = {'EDITION': 'oss'}
    services = integration_test_services(edition='oss')
    volumes = integration_test_services_volumes()
    package_steps = []
    publish_steps = []
    should_publish = ver_mode == 'release'
    should_upload = should_publish or ver_mode in ('release-branch',)
    init_steps = [
        identify_runner_step(),
        download_grabpl_step(),
        verify_gen_cue_step(),
        wire_install_step(),
        yarn_install_step(),
        compile_build_cmd(),
    ]

    build_steps = [
        build_backend_step(edition='oss', ver_mode=ver_mode),
        build_frontend_step(edition='oss', ver_mode=ver_mode),
        build_frontend_package_step(edition='oss', ver_mode=ver_mode),
        build_plugins_step(edition='oss', ver_mode=ver_mode),
    ]

    integration_test_steps = [
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
    ]

    # Insert remaining steps
    build_steps.extend(
        [
            package_step(edition='oss', ver_mode=ver_mode),
            copy_packages_for_docker_step(),
            build_docker_images_step(edition='oss', ver_mode=ver_mode, publish=True),
            build_docker_images_step(edition='oss', ver_mode=ver_mode, publish=True, ubuntu=True),
            grafana_server_step(edition='oss'),
            e2e_tests_step('dashboards-suite', tries=3),
            e2e_tests_step('smoke-tests-suite', tries=3),
            e2e_tests_step('panels-suite', tries=3),
            e2e_tests_step('various-suite', tries=3),
            e2e_tests_artifacts(),
            build_storybook_step(ver_mode=ver_mode),
        ]
    )

    if should_upload:
        publish_steps.extend(
            [
                upload_cdn_step(edition='oss', ver_mode=ver_mode, trigger=trigger_oss),
                upload_packages_step(edition='oss', ver_mode=ver_mode, trigger=trigger_oss),
            ]
        )

    if should_publish:
        publish_steps.append(store_storybook_step(ver_mode=ver_mode))
        store_npm_step = store_npm_packages_step()
        if store_npm_step:
            publish_steps.append(store_npm_step)

    windows_package_steps = get_windows_steps(edition='oss', ver_mode=ver_mode)

    windows_pipeline = pipeline(
        name='{}-oss-windows'.format(ver_mode),
        edition='oss',
        trigger=trigger,
        steps=[identify_runner_step('windows')] + windows_package_steps,
        platform='windows',
        depends_on=[
            # 'oss-build-e2e-publish-{}'.format(ver_mode),
            '{}-oss-build-e2e-publish'.format(ver_mode),
            '{}-oss-test-frontend'.format(ver_mode),
            '{}-oss-test-backend'.format(ver_mode),
            '{}-oss-integration-tests'.format(ver_mode),
        ],
        environment=environment,
    )

    pipelines = [
        pipeline(
            name='{}-oss-build-e2e-publish'.format(ver_mode),
            edition='oss',
            trigger=trigger,
            services=[],
            steps=init_steps + build_steps + package_steps + publish_steps,
            environment=environment,
            volumes=volumes,
        ),
        test_frontend(trigger, ver_mode, committish=committish),
        test_backend(trigger, ver_mode, committish=committish),
        pipeline(
            name='{}-oss-integration-tests'.format(ver_mode),
            edition='oss',
            trigger=trigger,
            services=services,
            steps=[
                download_grabpl_step(),
                identify_runner_step(),
                verify_gen_cue_step(),
                verify_gen_jsonnet_step(),
                wire_install_step(),
            ]
            + integration_test_steps,
            environment=environment,
            volumes=volumes,
        ),
        windows_pipeline,
    ]

    return pipelines


def enterprise_pipelines(ver_mode=ver_mode, trigger=release_trigger):
    if ver_mode == 'release':
        committish = '${DRONE_TAG}'
    elif ver_mode == 'release-branch':
        committish = '${DRONE_BRANCH}'
    else:
        committish = '${DRONE_COMMIT}'
    environment = {'EDITION': 'enterprise'}
    services = integration_test_services(edition='enterprise')
    volumes = integration_test_services_volumes()
    package_steps = []
    publish_steps = []
    should_publish = ver_mode == 'release'
    should_upload = should_publish or ver_mode in ('release-branch',)
    init_steps = [
        download_grabpl_step(),
        identify_runner_step(),
        clone_enterprise_step(committish=committish),
        init_enterprise_step(ver_mode),
        compile_build_cmd('enterprise'),
    ]

    build_steps = [
        build_backend_step(edition='enterprise', ver_mode=ver_mode),
        build_frontend_step(edition='enterprise', ver_mode=ver_mode),
        build_frontend_package_step(edition='enterprise', ver_mode=ver_mode),
        build_plugins_step(edition='enterprise', ver_mode=ver_mode),
        build_backend_step(
            edition='enterprise2', ver_mode=ver_mode, variants=['linux-amd64']
        ),
        package_step(
            edition='enterprise',
            ver_mode=ver_mode,
            include_enterprise2=True,
        ),
        copy_packages_for_docker_step(),
        build_docker_images_step(edition='enterprise', ver_mode=ver_mode, publish=True),
        build_docker_images_step(edition='enterprise', ver_mode=ver_mode, publish=True, ubuntu=True),
        grafana_server_step(edition='enterprise'),
        e2e_tests_step('dashboards-suite', tries=3),
        e2e_tests_step('smoke-tests-suite', tries=3),
        e2e_tests_step('panels-suite', tries=3),
        e2e_tests_step('various-suite', tries=3),
        e2e_tests_artifacts(),
    ]

    integration_test_steps = [
        postgres_integration_tests_step(),
        mysql_integration_tests_step(),
    ]

    if should_upload:
        upload_packages_enterprise = upload_packages_step(edition='enterprise', ver_mode=ver_mode, trigger=trigger_oss)
        upload_packages_enterprise['depends_on'] = ['package']

        upload_packages_enterprise2 = upload_packages_step(edition='enterprise2', ver_mode=ver_mode)
        upload_packages_enterprise2['depends_on'] = ['package-enterprise2']

        publish_steps.extend(
            [
                upload_cdn_step(edition='enterprise', ver_mode=ver_mode, trigger=trigger_oss),
                upload_packages_enterprise,
                package_step(
                    edition='enterprise2',
                    ver_mode=ver_mode,
                    include_enterprise2=True,
                    variants=['linux-amd64'],
                ),
                upload_cdn_step(edition='enterprise2', ver_mode=ver_mode),
                upload_packages_enterprise2,
            ]
        )


    init_steps.extend(
        set_deps(
            [
                wire_install_step(),
                yarn_install_step(),
                verify_gen_cue_step(),
                verify_gen_jsonnet_step(),
            ],
            [
                'init-enterprise',
            ],
        )
    )

    windows_package_steps = get_windows_steps(edition='enterprise', ver_mode=ver_mode)

    windows_pipeline = pipeline(
        name='{}-enterprise-windows'.format(ver_mode),
        edition='enterprise',
        trigger=trigger,
        steps=[identify_runner_step('windows')] + windows_package_steps,
        platform='windows',
        depends_on=[
            # 'enterprise-build-e2e-publish-{}'.format(ver_mode),
            '{}-enterprise-build-e2e-publish'.format(ver_mode),
            '{}-enterprise-test-frontend'.format(ver_mode),
            '{}-enterprise-test-backend'.format(ver_mode),
            '{}-enterprise-integration-tests'.format(ver_mode),
        ],
        environment=environment,
    )

    pipelines = [
        pipeline(
            name='{}-enterprise-build-e2e-publish'.format(ver_mode),
            edition='enterprise',
            trigger=trigger,
            services=[],
            steps=init_steps + build_steps + package_steps + publish_steps,
            environment=environment,
            volumes=volumes,
        ),
        test_frontend(trigger, ver_mode, committish=committish, edition='enterprise'),
        test_backend(trigger, ver_mode, committish=committish, edition='enterprise'),
        pipeline(
            name='{}-enterprise-integration-tests'.format(ver_mode),
            edition='enterprise',
            trigger=trigger,
            services=services,
            steps=[
                download_grabpl_step(),
                identify_runner_step(),
                clone_enterprise_step(committish=committish),
                init_enterprise_step(ver_mode),
            ]
            + set_deps(
                [
                    verify_gen_cue_step(),
                    verify_gen_jsonnet_step(),
                ],
                [
                    'init-enterprise',
                ],
            )
            + [
                wire_install_step(),
            ]
            + integration_test_steps
            + [
                redis_integration_tests_step(),
                memcached_integration_tests_step(),
            ],
            environment=environment,
            volumes=volumes,
        ),
        windows_pipeline,
    ]

    return pipelines


def enterprise2_pipelines(prefix='', ver_mode=ver_mode, trigger=release_trigger):
    if ver_mode == 'release':
        committish = '${DRONE_TAG}'
    elif ver_mode == 'release-branch':
        committish = '${DRONE_BRANCH}'
    else:
        committish = '${DRONE_COMMIT}'
    environment = {
        'EDITION': 'enterprise2',
    }
    services = integration_test_services(edition='enterprise')
    volumes = integration_test_services_volumes()
    package_steps = []
    publish_steps = []
    should_publish = ver_mode == 'release'
    should_upload = should_publish or ver_mode in ('release-branch',)
    init_steps = [
        download_grabpl_step(),
        identify_runner_step(),
        clone_enterprise_step(committish=committish),
        init_enterprise_step(ver_mode),
        compile_build_cmd('enterprise'),
    ]

    build_steps = [
        build_frontend_step(edition='enterprise', ver_mode=ver_mode),
        build_frontend_package_step(edition='enterprise', ver_mode=ver_mode),
        build_plugins_step(edition='enterprise', ver_mode=ver_mode),
        build_backend_step(edition='enterprise2', ver_mode=ver_mode, variants=['linux-amd64']),
    ]

    fetch_images = fetch_images_step('enterprise2')
    fetch_images.update(
        {'depends_on': ['build-docker-images', 'build-docker-images-ubuntu']}
    )
    upload_cdn = upload_cdn_step(edition='enterprise2', ver_mode=ver_mode)
    upload_cdn['environment'].update(
        {'ENTERPRISE2_CDN_PATH': from_secret('enterprise2-cdn-path')}
    )

    build_steps.extend(
        [
            package_step(
                edition='enterprise2',
                ver_mode=ver_mode,
                include_enterprise2=True,
                variants=['linux-amd64'],
            ),
            upload_cdn,
            copy_packages_for_docker_step(edition='enterprise2'),
            build_docker_images_step(edition='enterprise2', ver_mode=ver_mode, publish=True),
            build_docker_images_step(edition='enterprise2', ver_mode=ver_mode, publish=True, ubuntu=True),
            fetch_images,
            publish_images_step(
                'enterprise2',
                'release',
                mode='enterprise2',
                docker_repo='${{DOCKER_ENTERPRISE2_REPO}}',
            ),
        ]
    )

    if should_upload:
        step = upload_packages_step(edition='enterprise2', ver_mode=ver_mode)
        step['depends_on'] = ['package-enterprise2']
        publish_steps.append(step)

    init_steps.extend(
        set_deps(
            [
                wire_install_step(),
                yarn_install_step(),
                verify_gen_cue_step(),
            ],
            [
                'init-enterprise',
            ],
        )
    )

    pipelines = [
        pipeline(
            name='{}{}-enterprise2-build-e2e-publish'.format(prefix, ver_mode),
            edition='enterprise',
            trigger=trigger,
            services=[],
            steps=init_steps + build_steps + package_steps + publish_steps,
            volumes=volumes,
            environment=environment,
        ),
    ]

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
            'PRERELEASE_BUCKET': from_secret('prerelease_bucket'),
        },
        'commands': [
            './bin/grabpl artifacts publish {}--tag $${{DRONE_TAG}} --src-bucket $${{PRERELEASE_BUCKET}}'.format(
                security
            )
        ],
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

    return [
        pipeline(
            name='publish-artifacts-{}'.format(mode),
            trigger=trigger,
            steps=steps,
            edition="all",
            environment={'EDITION': 'all'},
        )
    ]


def publish_packages_pipeline():
    trigger = {
        'event': ['promote'],
        'target': ['public'],
    }
    oss_steps = [
        download_grabpl_step(),
        compile_build_cmd(),
        publish_linux_packages_step(edition='oss', package_manager='deb'),
        publish_linux_packages_step(edition='oss', package_manager='rpm'),
        publish_grafanacom_step(edition='oss', ver_mode='release'),
    ]

    enterprise_steps = [
        download_grabpl_step(),
        compile_build_cmd(),
        publish_linux_packages_step(edition='enterprise', package_manager='deb'),
        publish_linux_packages_step(edition='enterprise', package_manager='rpm'),
        publish_grafanacom_step(edition='enterprise', ver_mode='release'),
    ]
    deps = [
        'publish-artifacts-public',
        'publish-docker-oss-public',
        'publish-docker-enterprise-public',
    ]

    return [
        pipeline(
            name='publish-packages-oss',
            trigger=trigger,
            steps=oss_steps,
            edition="all",
            depends_on=deps,
            environment={'EDITION': 'oss'},
        ),
        pipeline(
            name='publish-packages-enterprise',
            trigger=trigger,
            steps=enterprise_steps,
            edition="all",
            depends_on=deps,
            environment={'EDITION': 'enterprise'},
        ),
    ]


def publish_npm_pipelines(mode):
    trigger = {
        'event': ['promote'],
        'target': [mode],
    }
    steps = [
        download_grabpl_step(),
        yarn_install_step(),
        retrieve_npm_packages_step(),
        release_npm_packages_step(),
    ]

    return [
        pipeline(
            name='publish-npm-packages-{}'.format(mode),
            trigger=trigger,
            steps=steps,
            edition="all",
            environment={'EDITION': 'all'},
        )
    ]


def artifacts_page_pipeline():
    trigger = {
        'event': ['promote'],
        'target': 'security',
    }
    return [
        pipeline(
            name='publish-artifacts-page',
            trigger=trigger,
            steps=[download_grabpl_step(), artifacts_page_step()],
            edition="all",
            environment={'EDITION': 'all'},
        )
    ]
