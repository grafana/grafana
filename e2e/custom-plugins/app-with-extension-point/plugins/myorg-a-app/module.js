define(['@grafana/data', 'react'], function (data, React) {
  'use strict';

  const styles = {
    container: 'a-app-body',
  };

  class RootComponent extends React.PureComponent {
    render() {
      return React.createElement(
        'div',
        { 'data-testid': styles.container, className: 'page-container' },
        'Hello Grafana!'
      );
    }
  }

  const plugin = new data.AppPlugin().setRootPage(RootComponent).configureExtensionLink({
    title: 'Go to A',
    description: 'Navigating to plugin A',
    extensionPointId: 'plugins/myorg-extensionpoint-app/actions',
    path: '/a/myorg-a-app/',
  });

  return { plugin: plugin };
});
