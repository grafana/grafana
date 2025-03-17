import { PluginMeta } from '../types/plugin';

export function matchPluginId(idToMatch: string, pluginMeta: PluginMeta) {
  if (pluginMeta.id === idToMatch) {
    return true;
  }

  if (idToMatch === 'prometheus') {
    if (pluginMeta.id === 'grafana-amazonprometheus-datasource') {
      return true;
    }
  }

  if (pluginMeta.aliasIDs) {
    return pluginMeta.aliasIDs.includes(idToMatch);
  }

  return false;
}
