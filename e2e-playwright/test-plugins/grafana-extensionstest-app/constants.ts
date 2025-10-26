import pluginJson from './plugin.json';

export const PLUGIN_BASE_URL = `/a/${pluginJson.id}`;

export enum ROUTES {
  LegacyGetters = 'legacy-getters',
  LegacyHooks = 'legacy-hooks',
  ExposedComponents = 'exposed-components',
  AddedComponents = 'added-components',
  AddedLinks = 'added-links',
}
