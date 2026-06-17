import { config } from '@grafana/runtime';
import { UNCONFIGURED_PANEL_PLUGIN_ID } from 'app/features/dashboard-scene/scene/UnconfiguredPanel';

export function getDefaultPluginId(): string {
  return config.featureToggles.dashboardNewLayouts ? UNCONFIGURED_PANEL_PLUGIN_ID : 'timeseries';
}
