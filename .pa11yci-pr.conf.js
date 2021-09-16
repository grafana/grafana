var config = {
  defaults: {
    concurrency: 1,
    runners: ['axe'],
    chromeLaunchConfig: {
      args: ['--no-sandbox'],
    },
  },

  urls: [
    {
      url: '${HOST}/login',
      actions: [
        "set field input[name='user'] to admin",
        "set field input[name='password'] to admin",
        "click element button[aria-label='Login button']",
        "wait for element [aria-label='Skip change password button'] to be visible",
      ],
      threshold: 2,
    },
    {
      url: '${HOST}/?orgId=1',
      threshold: 7,
    },
    {
      url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge',
      hideElements: '.sidemenu',
      threshold: 2,
    },
    {
      url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=settings',
      rootElement: '.dashboard-settings',
      threshold: 10,
    },
    {
      url: '${HOST}/?orgId=1&search=open',
      rootElement: '.main-view',
      threshold: 15,
    },
    {
      url: '${HOST}/alerting/list',
      rootElement: '.main-view',
      threshold: 7,
    },
    {
      url: '${HOST}/datasources',
      rootElement: '.main-view',
      threshold: 36,
    },
    {
      url: '${HOST}/org/users',
      rootElement: '.main-view',
      threshold: 4,
    },
    {
      url: '${HOST}/org/teams',
      rootElement: '.main-view',
      threshold: 1,
    },
    {
      url: '${HOST}/plugins',
      rootElement: '.main-view',
      threshold: 41,
    },
    {
      url: '${HOST}/org',
      rootElement: '.main-view',
      threshold: 2,
    },
    {
      url: '${HOST}/org/apikeys',
      rootElement: '.main-view',
      threshold: 5,
    },
    {
      url: '${HOST}/dashboards',
      rootElement: '.main-view',
      threshold: 8,
    },
  ],
};

function myPa11yCiConfiguration(urls, defaults) {
  const HOST_SERVER = process.env.HOST || 'localhost';
  const PORT_SERVER = process.env.PORT || '3000';
  for (var idx = 0; idx < urls.length; idx++) {
    urls[idx] = { ...urls[idx], url: urls[idx].url.replace('${HOST}', `${HOST_SERVER}:${PORT_SERVER}`) };
  }

  return {
    defaults: defaults,
    urls: urls,
  };
}

module.exports = myPa11yCiConfiguration(config.urls, config.defaults);
