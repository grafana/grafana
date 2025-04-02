import { PluginMeta } from '../types/plugin';

export function matchPluginId(idToMatch: string, pluginMeta: PluginMeta) {
  if (pluginMeta.id === idToMatch) {
    return true;
  }

  if (idToMatch === 'prometheus') {
   return isPromFlavor(pluginMeta.id);
  }

  if (pluginMeta.aliasIDs) {
    return pluginMeta.aliasIDs.includes(idToMatch);
  }

  return false;
}

export function isPromFlavor(pluginId: string): boolean {
  const regex = new RegExp('grafana-.*prometheus-datasource');
  return regex.test(pluginId);
}
