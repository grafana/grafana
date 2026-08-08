/*
 * This is a dummy plugin to test the frontend sandbox
 * It is not meant to be used in any other way
 * This file doesn't require any compilation
 */
define(['react', '@grafana/data', 'react-router'], function (React, grafanaData, ReactRouter) {
  const { AppPlugin } = grafanaData;
  const { Routes, Route } = ReactRouter;

  function PageOne() {
    return React.createElement(
      'div',
      {
        'data-testid': 'sandbox-app-test-page-one',
      },
      'This is a page one'
    );
  }

  function App() {
    return React.createElement(
      Routes,
      null,
      React.createElement(Route, { path: '*', element: React.createElement(PageOne) })
    );
  }
  function AppConfig() {
    return React.createElement(
      'div',
      {
        'data-testid': 'sandbox-app-test-config-page',
      },

      'This is a config page'
    );
  }

  const plugin = new AppPlugin().setRootPage(App).addConfigPage({
    title: 'Configuration',
    icon: 'cog',
    body: AppConfig,
    id: 'configuration',
  });
  return { plugin };
});
