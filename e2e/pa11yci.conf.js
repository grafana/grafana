const config = {
  defaults: {
    concurrency: 1,
    runners: ['axe'],
    useIncognitoBrowserContext: false,
    standard: 'WCAG2AA',
    chromeLaunchConfig: {
      executablePath: '/usr/bin/google-chrome',
      args: ['--no-sandbox'],
    },
    // see https://github.com/grafana/grafana/pull/41693#issuecomment-979921463 for context
    // on why we're ignoring singleValue/react-select-*-placeholder elements
    hideElements: '#updateVersion, [class*="-singleValue"], [id^="react-select-"][id$="-placeholder"]',
    reporters: ['cli', ['json', { fileName: './pa11y-ci-results.json' }]],
  },

  urls: [
    {
      url: '${HOST}/login',
      threshold: 0,
    },
    {
      url: '${HOST}/login',
      actions: [
        "wait for element input[name='user'] to be added",
        "set field input[name='user'] to admin",
        "set field input[name='password'] to admin",
        "click element button[data-testid='data-testid Login button']",
        "wait for element button[data-testid='data-testid Skip change password button'] to be visible",
      ],
      threshold: 2,
    },
    {
      url: '${HOST}/?orgId=1',
      threshold: 0,
    },
    {
      url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge',
      threshold: 0,
    },

    // Dashboard settings
    {
      url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=settings',
      threshold: 0,
    },
    {
      url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=annotations',
      threshold: 0,
    },
    {
      url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=variables',
      threshold: 0,
    },
    {
      url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=links',
      threshold: 0,
    },
    {
      url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=versions',
      threshold: 0,
    },
    {
      url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=permissions',
      // TODO: improve the accessibility of the permission tab https://github.com/grafana/grafana/issues/77203
      threshold: 5,
    },
    {
      url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=dashboard_json',
      threshold: 2,
    },

    // Misc
    {
      url: '${HOST}/?orgId=1&search=open',
      threshold: 0,
    },
    {
      url: '${HOST}/alerting/list',
      // the unified alerting promotion alert's content contrast is too low
      // see https://github.com/grafana/grafana/pull/41829
      threshold: 7,
    },
    {
      url: '${HOST}/datasources',
      threshold: 0,
    },
    {
      url: '${HOST}/org/users',
      threshold: 2,
    },
    {
      url: '${HOST}/org/teams',
      threshold: 1,
    },
    {
      url: '${HOST}/plugins',
      threshold: 0,
    },
    {
      url: '${HOST}/org',
      threshold: 2,
    },
    {
      url: '${HOST}/org/apikeys',
      threshold: 4,
    },
    {
      url: '${HOST}/dashboards',
      threshold: 2,
    },
  ],
};

function myPa11yCiConfiguration(urls, defaults) {
  const HOST_SERVER = process.env.HOST || 'localhost';
  const PORT_SERVER = process.env.PORT || '3001';
  const noThresholds = process.env.NO_THRESHOLDS === 'true';

  urls = urls.map((test, index) => {
    return {
      ...test,
      url: test.url.replace('${HOST}', `${HOST_SERVER}:${PORT_SERVER}`),
      screenCapture: `./screenshots/screenshot-${index}.png`,
      rootElement: '.main-view',
      wait: 500,

      // Depending on NO_THRESHOLDS (--no-threshold-fail in the dagger command), clear the thresholds
      // to allow pa11y to fail the check and include error details in the results file
      threshold: noThresholds ? undefined : test.threshold,
    };
  });

  return {
    defaults: defaults,
    urls: urls,
  };
}

module.exports = myPa11yCiConfiguration(config.urls, config.defaults);
