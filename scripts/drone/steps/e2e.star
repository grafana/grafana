load(
    'scripts/drone/steps/var.star',
    'build_image',
    'disable_tests',
)
load(
    'scripts/drone/steps/enterprise.star',
    'enterprise2_suffix',
)

# Pipeline version-level Feature toggles
load(
    'scripts/drone/opts.star',
    'cypress_image',
    'e2e_multiple_suites',
)

def e2e_tests_server_step(edition, port=3001):
    package_file_pfx = ''
    if edition == 'enterprise2':
        package_file_pfx = 'grafana' + enterprise2_suffix(edition)
    elif edition == 'enterprise':
        package_file_pfx = 'grafana-' + edition

    environment = {
        'PORT': port,
    }
    if package_file_pfx:
        environment['PACKAGE_FILE'] = 'dist/{}-*linux-amd64.tar.gz'.format(package_file_pfx)
        environment['RUNDIR'] = 'e2e/tmp-{}'.format(package_file_pfx)

    return {
        'name': 'end-to-end-tests-server' + enterprise2_suffix(edition),
        'image': build_image,
        'detach': True,
        'depends_on': [
            'package' + enterprise2_suffix(edition),
        ],
        'environment': environment,
        'commands': [
            './e2e/start-server',
        ],
    }

def e2e_tests_step(edition, port=3001, suite=None, tries=None):
    cmd = './bin/grabpl e2e-tests --port {}'.format(port)
    name = 'end-to-end-tests'

    if suite:
      cmd += ' --suite {}'.format(port, suite)
      name = 'end-to-end-tests-{}'.format(suite)
    if tries:
        cmd += ' --tries {}'.format(tries)
    return {
        'name': name + enterprise2_suffix(edition),
        'image': cypress_image,
        'depends_on': [
            'package',
        ],
        'environment': {
            'HOST': 'end-to-end-tests-server' + enterprise2_suffix(edition),
        },
        'commands': [
            'apt-get install -y netcat',
            cmd,
        ],
    }

def e2e_test_steps(edition, port=3001, tries=None):
    steps = []
    if e2e_multiple_suites:
        return [
            e2e_tests_step(suite='dashboards-suite', port=port, edition=edition),
            e2e_tests_step(suite='smoke-tests-suite', port=port, edition=edition),
            e2e_tests_step(suite='panels-suite', port=port, edition=edition),
            e2e_tests_step(suite='various-suite', port=port, edition=edition),
        ]
    return [
        e2e_tests_step(port=port, edition=edition)
    ]

def end_to_end_tests_deps(edition):
    if disable_tests:
        return []
    if e2e_multiple_suites:
        return [
            'end-to-end-tests-dashboards-suite' + enterprise2_suffix(edition),
            'end-to-end-tests-panels-suite' + enterprise2_suffix(edition),
            'end-to-end-tests-smoke-tests-suite' + enterprise2_suffix(edition),
            'end-to-end-tests-various-suite' + enterprise2_suffix(edition),
        ]
    return [
        'end-to-end-tests' + enterprise2_suffix(edition)
    ]
