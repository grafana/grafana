import { PluginMeta } from '../types';

export function matchPluginId(idToMatch: string, pluginMeta: PluginMeta) {
  if (pluginMeta.id === idToMatch) {
    return true;
  }

  if (pluginMeta.aliasIDs) {
    return pluginMeta.aliasIDs.includes(idToMatch);
  }

  return false;
}
