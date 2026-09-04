import * as grafanaData from '@grafana/data';
// eslint-disable-next-line no-restricted-imports
import * as grafanaUI from '@grafana/ui';

export async function loadPluginGrafanaUI(): Promise<System.Module> {
  const grafanaUISlate = await import(/* webpackChunkName: "grafana-ui-slate" */ '@grafana/ui/slate');

  return {
    ...grafanaUI,
    ...grafanaUISlate,
    // Help the 6.4 to 6.5 migration. These classes moved from @grafana/ui to @grafana/data.
    PanelPlugin: grafanaData.PanelPlugin,
    DataSourcePlugin: grafanaData.DataSourcePlugin,
    AppPlugin: grafanaData.AppPlugin,
    DataSourceApi: grafanaData.DataSourceApi,
  };
}
