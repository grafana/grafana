/*
 * Dev-only app plugin used to verify nested (3-level) navigation built from the
 * `parent` include field in plugin.json. It is not meant to be used for anything
 * else. This file requires no compilation.
 *
 * The mega menu, page tabs and breadcrumbs are all driven by the backend nav
 * model, so the root page only needs to render which page is active.
 */
define(['react', '@grafana/data'], function (React, grafanaData) {
  const { AppPlugin } = grafanaData;

  function App() {
    const path = window.location.pathname;
    let page = 'Home';
    if (path.endsWith('/settings/usage')) {
      page = 'Settings → Usage (3rd level)';
    } else if (path.endsWith('/settings')) {
      page = 'Settings (2nd level)';
    }
    return React.createElement(
      'div',
      { 'data-testid': 'nav-nesting-app-test' },
      'Nav nesting test app — current page: ' + page
    );
  }

  const plugin = new AppPlugin().setRootPage(App);
  return { plugin };
});
