import { PluginPreloadResult } from '../pluginPreloader';

import { Registry } from './registry';
import { registryLog } from './registryLog';

export type ExportedComponent = {
  id: string;
  pluginId: string;
  description: string;
  component: React.FunctionComponent;
};

export type ComponentByIdState = {
  [id: string]: ExportedComponent;
};

export function addComponentToState(state: ComponentByIdState, result: PluginPreloadResult): ComponentByIdState {
  const { pluginId, exportedComponents, error } = result;

  if (error) {
    registryLog.error({
      message: 'Plugin failed to load, skip exposing its components.',
      pluginId,
      error,
    });
    return state;
  }

  if (!exportedComponents) {
    return state;
  }

  for (const config of exportedComponents) {
    const { id } = config;

    // check if config is valid, skip and warn if invalid.
    // if(isConfigValid(config)) { ... }

    if (state[id]) {
      // log a warning that a component already exists for that id.
      continue;
    }

    state[id] = config;
  }

  return state;
}

export const registry = new Registry<ComponentByIdState>({
  getInitialState: () => ({}),
  addToState: addComponentToState,
});
