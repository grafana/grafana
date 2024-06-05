import { PluginExtensionLinkConfig } from '@grafana/data';

import { PluginPreloadResult } from '../pluginPreloader';

import { Registry } from './registry';
import { registryLog } from './registryLog';

export type AddedLink = PluginExtensionLinkConfig & {
  pluginId: string;
};

type LinksByTargetState = {
  [target: string]: AddedLink[];
};

export function addLinksToState(state: LinksByTargetState, result: PluginPreloadResult): LinksByTargetState {
  const { pluginId, addedLinks, error } = result;

  if (error) {
    registryLog.error({
      message: 'Plugin failed to load, skip adding its links to targets.',
      pluginId,
      error,
    });
    return state;
  }

  if (!addedLinks) {
    return state;
  }

  for (const config of addedLinks) {
    const { extensionPointId } = config;

    // check if config is valid, skip and warn if invalid.
    // if(isConfigValid(config)) { ... }

    if (!Array.isArray(state[extensionPointId])) {
      state[extensionPointId] = [];
    }

    state[extensionPointId].push({
      pluginId,
      ...config,
    });
  }

  return state;
}

export const registry = new Registry<LinksByTargetState>({
  getInitialState: () => ({}),
  addToState: addLinksToState,
});
