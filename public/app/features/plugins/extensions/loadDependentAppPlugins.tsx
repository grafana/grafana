import { preloadPlugins } from '../pluginPreloader';

import { getAppPluginConfigs } from './utils';

export type PluginDependencyPredicate = (id: string) => Promise<string[]>;

/**
 * Shared by `useLoadAppPlugins` and the observable extension APIs (e.g. `getObservablePluginLinks`) so both
 * get identical on-demand plugin loading for a given predicate (e.g. `getExtensionPointPluginDependencies`).
 *
 * Deliberately kept out of `utils.tsx`: that file is imported by the extension registries
 * (`registry/setup.ts` -> `AddedComponentsRegistry.ts` -> `utils.tsx`), and `preloadPlugins` imports
 * `pluginImporter.ts`, which imports `registry/setup.ts` - pulling `preloadPlugins` into `utils.tsx` would
 * create a circular import.
 */
export async function loadDependentAppPlugins(id: string, predicate: PluginDependencyPredicate): Promise<void> {
  const filteredConfigs = await predicate(id);

  if (!filteredConfigs.length) {
    return;
  }

  const appConfigs = await getAppPluginConfigs(filteredConfigs);

  if (!appConfigs.length) {
    return;
  }

  await preloadPlugins(appConfigs);
}
