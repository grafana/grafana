jest.mock(
  '@grafana/ui',
  () => {
    const ui = { Button: 'plugin-button' };
    Object.defineProperty(ui, '__esModule', { value: true });
    return ui;
  },
  { virtual: true }
);
jest.mock(
  '@grafana/ui/slate',
  () => {
    const slate = { QueryField: 'plugin-query-field' };
    Object.defineProperty(slate, '__esModule', { value: true });
    return slate;
  },
  { virtual: true }
);

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
