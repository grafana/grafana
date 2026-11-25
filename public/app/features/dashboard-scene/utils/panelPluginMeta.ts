import { type PanelPluginMeta } from '@grafana/data';
import { type PanelPluginMetas } from '@grafana/runtime/internal';

export function findPanelPluginMeta(panelMetas: PanelPluginMetas, pluginId: string): PanelPluginMeta | undefined {
  return panelMetas[pluginId] ?? Object.values(panelMetas).find((meta) => meta.aliasIDs?.includes(pluginId));
}
