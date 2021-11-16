var config = {
  defaults: {
    concurrency: 1,
    runners: ['axe'],
    useIncognitoBrowserContext: false,
    chromeLaunchConfig: {
      args: ['--no-sandbox'],
    },
  },

  urls: [
    {
      url: '${HOST}/login',
      wait: 500,
      rootElement: '.main-view',
      threshold: 12,
    },
    {
      url: '${HOST}/login',
      wait: 500,
      actions: [
        "wait for element input[name='user'] to be added",
        "set field input[name='user'] to admin",
        "set field input[name='password'] to admin",
        "click element button[aria-label='Login button']",
        "wait for element [aria-label='Skip change password button'] to be visible",
      ],
      threshold: 14,
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/?orgId=1',
      wait: 500,
      threshold: 1,
    },
    {
      url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge',
      wait: 500,
      rootElement: '.main-view',
      threshold: 51,
    },
    {
      url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=settings',
      wait: 500,
      rootElement: '.main-view',
      threshold: 54,
    },
    {
      url: '${HOST}/?orgId=1&search=open',
      wait: 500,
      rootElement: '.main-view',
      threshold: 8,
    },
    {
      url: '${HOST}/alerting/list',
      wait: 500,
      rootElement: '.main-view',
      threshold: 1,
    },
    {
      url: '${HOST}/datasources',
      wait: 500,
      rootElement: '.main-view',
      threshold: 0,
    },
    {
      url: '${HOST}/org/users',
      wait: 500,
      rootElement: '.main-view',
      threshold: 0,
    },
    {
      url: '${HOST}/org/teams',
      wait: 500,
      rootElement: '.main-view',
      threshold: 0,
    },
    {
      url: '${HOST}/plugins',
      wait: 500,
      rootElement: '.main-view',
      threshold: 0,
    },
    {
      url: '${HOST}/org',
      wait: 500,
      rootElement: '.main-view',
      threshold: 3,
    },
    {
      url: '${HOST}/org/apikeys',
      wait: 500,
      rootElement: '.main-view',
      threshold: 1,
    },
    {
      url: '${HOST}/dashboards',
      wait: 500,
      rootElement: '.main-view',
      threshold: 2,
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
