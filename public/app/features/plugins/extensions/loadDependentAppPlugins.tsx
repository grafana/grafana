import { preloadPlugins } from '../pluginPreloader';

import { getAppPluginConfigs } from './utils';

export type PluginDependencyPredicate = (id: string) => Promise<string[]>;

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
