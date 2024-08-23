import pluginJson from './plugin.json';

export const PLUGIN_BASE_URL = `/a/${pluginJson.id}`;

export enum ROUTES {
  LegacyAPIs = 'legacy-apis',
  ExposedComponents = 'exposed-components',
  AddedComponents = 'added-components',
}
