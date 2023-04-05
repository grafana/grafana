import { PluginExtensionPanelContext } from '@grafana/data';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

export function createExtensionPanelContext(panel: PanelModel, dashboard: DashboardModel): PluginExtensionPanelContext {
  return {
    id: panel.id,
    pluginId: panel.type,
    title: panel.title,
    timeRange: dashboard.time,
    timeZone: dashboard.timezone,
    dashboard: {
      uid: dashboard.uid,
      title: dashboard.title,
      tags: Array.from<string>(dashboard.tags),
    },
    targets: panel.targets,
  };
}
