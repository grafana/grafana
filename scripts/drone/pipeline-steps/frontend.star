load('scripts/drone/init/init.star', 'build_image', 'enterprise2_suffix', 'end_to_end_tests_deps')
load('scripts/drone/vault.star', 'from_secret', )


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
        'image': 'grafana/docker-puppeteer:1.0.0',
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


def frontend_metrics_step(edition):
    if edition in ('enterprise', 'enterprise2'):
        return None

    return {
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
            './scripts/ci-frontend-metrics.sh | ./bin/grabpl publish-metrics $${GRAFANA_MISC_STATS_API_KEY}',
        ],
    }


def release_canary_npm_packages_step(edition):
    if edition in ('enterprise', 'enterprise2'):
        return None

    return {
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
