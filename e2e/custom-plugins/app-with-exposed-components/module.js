define(['@grafana/data', '@grafana/runtime', 'react'], function (grafanaData, grafanaRuntime, React) {
  var AppPlugin = grafanaData.AppPlugin;
  var usePluginComponent = grafanaRuntime.usePluginComponent;

  var MyComponent = function () {
    var plugin = usePluginComponent('myorg-componentexposer-app/reusable-component/v1');
    var TestComponent = plugin.component;
    var isLoading = plugin.isLoading;

    if (!TestComponent) {
      return null;
    }

    return React.createElement(
      React.Fragment,
      null,
      React.createElement('div', null, 'Exposed component:'),
      isLoading ? 'Loading..' : React.createElement(TestComponent, { name: 'World' })
    );
  };

  var App = function () {
    return React.createElement('div', null, 'Hello Grafana!', React.createElement(MyComponent, null));
  };

  var plugin = new AppPlugin().setRootPage(App);
  return { plugin: plugin };
});
