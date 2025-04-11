import { PluginMeta } from '../types/plugin';

export function matchPluginId(idToMatch: string, pluginMeta: PluginMeta) {
  if (pluginMeta.id === idToMatch) {
    return true;
  }

  if (isPromFlavor(idToMatch)) {
    return isPromFlavor(pluginMeta.id);
  }

  if (pluginMeta.aliasIDs) {
    return pluginMeta.aliasIDs.includes(idToMatch);
  }

  return false;
}

function isPromFlavor(pluginId: string): boolean {
  if (pluginId === 'prometheus') {
    return true;
  }
  const regex = new RegExp('^grafana-[0-9a-z]+prometheus-datasource$');
  return regex.test(pluginId);
}
