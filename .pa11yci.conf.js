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
    },
    {
      url: '${HOST}/?orgId=1',
    },
    {
      url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge',
      hideElements: '.sidemenu',
    },
    {
      url: '${HOST}/d/O6f11TZWk/panel-tests-bar-gauge?orgId=1&editview=settings',
      rootElement: '.dashboard-settings',
    },
    {
      url: '${HOST}/?orgId=1&search=open',
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/alerting/list',
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/datasources',
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/org/users',
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/org/teams',
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/plugins',
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/org',
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/org/apikeys',
      rootElement: '.main-view',
    },
    {
      url: '${HOST}/dashboards',
      rootElement: '.main-view',
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
