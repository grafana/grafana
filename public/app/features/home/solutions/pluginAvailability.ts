import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { contextSrv } from 'app/core/services/context_srv';
import { type LocalPlugin } from 'app/features/plugins/admin/types';
import { AccessControlAction } from 'app/types/accessControl';

import { fetchInstalledPlugins } from '../Recommendations/pluginRecommendations';

export type PluginAvailability = { state: 'enable'; canEnable: boolean } | { state: 'setup' };

function readAvailability(plugins: LocalPlugin[]): Map<string, PluginAvailability> {
  const availability = new Map<string, PluginAvailability>();

  // /api/plugins always includes core plugins, so an empty inventory is unreliable. Offer nothing.
  if (!plugins.length) {
    return availability;
  }

  for (const plugin of plugins) {
    if (plugin.enabled) {
      availability.set(plugin.id, { state: 'setup' });
    } else {
      availability.set(plugin.id, {
        state: 'enable',
        canEnable: contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsWrite, plugin),
      });
    }
  }

  return availability;
}

/** Returns offer state by plugin ID from the shared inventory; failures return an empty map. */
export function pluginAvailability(): Promise<ReadonlyMap<string, PluginAvailability>> {
  return fetchInstalledPlugins()
    .then(readAvailability)
    .catch(() => new Map<string, PluginAvailability>());
}

export function setupGuideEnabled(): Promise<boolean> {
  return pluginAvailability().then((availability) => availability.get(SETUPGUIDE_PLUGIN_ID)?.state === 'setup');
}
