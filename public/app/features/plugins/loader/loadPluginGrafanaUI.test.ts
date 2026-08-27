jest.mock('@grafana/ui', () => ({ Button: 'plugin-button' }), { virtual: true });
jest.mock('@grafana/ui/slate', () => ({ QueryField: 'plugin-query-field' }), { virtual: true });

import { AppPlugin, DataSourceApi, DataSourcePlugin, PanelPlugin } from '@grafana/data';

import { loadPluginGrafanaUI } from './loadPluginGrafanaUI';

describe('loadPluginGrafanaUI', () => {
  it('combines core, Slate, and legacy data exports for plugins', async () => {
    const grafanaUI = await loadPluginGrafanaUI();

    expect(grafanaUI).toEqual({
      Button: 'plugin-button',
      QueryField: 'plugin-query-field',
      PanelPlugin,
      DataSourcePlugin,
      AppPlugin,
      DataSourceApi,
    });
  });
});
