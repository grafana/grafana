import { PluginExtensionComponentConfig } from '@grafana/data';

import { PluginPreloadResult } from '../pluginPreloader';

import { Registry } from './registry';
import { registryLog } from './registryLog';

export type AddedComponent = PluginExtensionComponentConfig & {
  pluginId: string;
};

type ComponentsByTargetState = {
  [target: string]: AddedComponent[];
};

export function addComponentsToState(
  state: ComponentsByTargetState,
  result: PluginPreloadResult
): ComponentsByTargetState {
  const { pluginId, addedComponents, error } = result;

  if (error) {
    registryLog.error({
      message: 'Plugin failed to load, skip adding its components to targets.',
      pluginId,
      error,
    });
    return state;
  }

  if (!addedComponents) {
    return state;
  }

  for (const config of addedComponents) {
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

export const registry = new Registry<ComponentsByTargetState>({
  getInitialState: () => ({}),
  addToState: addComponentsToState,
});
