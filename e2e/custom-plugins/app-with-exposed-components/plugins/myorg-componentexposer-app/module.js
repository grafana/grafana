define(['@grafana/data', 'module', 'react'], function (grafanaData, amdModule, React) {
  const plugin = new grafanaData.AppPlugin().exposeComponent({
    id: 'myorg-componentexposer-app/reusable-component/v1',
    title: 'Reusable component',
    description: 'A component that can be reused by other app plugins.',
    component: function ({ name }) {
      return React.createElement('div', { 'data-testid': 'exposed-component' }, 'Hello ', name, '!');
    },
  });

  return {
    plugin: plugin,
  };
});
