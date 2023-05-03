var dashboardSettings = [
  {
    url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=settings',
    wait: 500,
    rootElement: '.main-view',
  },
  {
    url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=annotations',
    wait: 500,
    rootElement: '.main-view',
  },
  {
    url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=templating',
    wait: 500,
    rootElement: '.main-view',
  },
  {
    url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=links',
    wait: 500,
    rootElement: '.main-view',
  },
  {
    url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=versions',
    wait: 500,
    rootElement: '.main-view',
  },
  {
    url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=permissions',
    wait: 500,
    rootElement: '.main-view',
  },
  {
    url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=dashboard_json',
    wait: 500,
    rootElement: '.main-view',
  },
];
var config = {
  defaults: {
    concurrency: 1,
    runners: ['axe'],
    useIncognitoBrowserContext: false,
    standard: 'WCAG2AA',
    chromeLaunchConfig: {
      args: ['--no-sandbox'],
    },
    // see https://github.com/grafana/grafana/pull/41693#issuecomment-979921463 for context
    // on why we're ignoring singleValue/react-select-*-placeholder elements
    hideElements: '#updateVersion, [class*="-singleValue"], [id^="react-select-"][id$="-placeholder"]',
  },

  urls: [
    {
      url: '${HOST}/login',
      wait: 500,
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/login', //skip password and login
      actions: [
        "wait for element input[name='user'] to be added",
        "set field input[name='user'] to admin",
        "set field input[name='password'] to admin",
        "click element button[aria-label='Login button']",
        "wait for element [aria-label='Skip change password button'] to be visible",
      ],
      wait: 500,
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/?orgId=1',
      wait: 500,
    },
    {
      url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge',
      wait: 500,
      rootElement: '.main-view',
    },
    ...dashboardSettings,
    {
      url: '${HOST}/?orgId=1&search=open',
      wait: 500,
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/alerting/list',
      wait: 500,
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/datasources',
      wait: 500,
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/org/users',
      wait: 500,
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/org/teams',
      wait: 500,
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/plugins',
      wait: 500,
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/org',
      wait: 500,
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/org/apikeys',
      wait: 500,
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/dashboards',
      wait: 500,
      rootElement: '.main-view',
    },
  ],
};

function myPa11yCiConfiguration(urls, defaults) {
  const HOST_SERVER = process.env.HOST || 'localhost';
  const PORT_SERVER = process.env.PORT || '3001';
  for (var idx = 0; idx < urls.length; idx++) {
    urls[idx] = { ...urls[idx], url: urls[idx].url.replace('${HOST}', `${HOST_SERVER}:${PORT_SERVER}`) };
  }
  return {
    defaults: defaults,
    urls: urls,
  };
}

module.exports = myPa11yCiConfiguration(config.urls, config.defaults);
