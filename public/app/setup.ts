import {
  setPluginExtensionGetter,
  setPluginExtensionsHook,
  setPluginComponentHook,
  setPluginComponentsHook,
  setPluginLinksHook,
} from '@grafana/runtime';

import { contextSrv } from './core/services/context_srv';
import { createPluginExtensionsGetter } from './features/plugins/extensions/getPluginExtensions';
import { pluginExtensionRegistries } from './features/plugins/extensions/registry/setup';
import { usePluginComponent } from './features/plugins/extensions/usePluginComponent';
import { usePluginComponents } from './features/plugins/extensions/usePluginComponents';
import { createUsePluginExtensions } from './features/plugins/extensions/usePluginExtensions';
import { usePluginLinks } from './features/plugins/extensions/usePluginLinks';
import { getAppPluginsToAwait, getAppPluginsToPreload } from './features/plugins/extensions/utils';
import { preloadPlugins } from './features/plugins/pluginPreloader';

export async function initPlugins() {
  if (contextSrv.user.orgRole !== '') {
    const appPluginsToAwait = getAppPluginsToAwait();
    const appPluginsToPreload = getAppPluginsToPreload();

    preloadPlugins(appPluginsToPreload);
    await preloadPlugins(appPluginsToAwait);
  }

  setPluginExtensionGetter(createPluginExtensionsGetter(pluginExtensionRegistries));
  setPluginExtensionsHook(createUsePluginExtensions(pluginExtensionRegistries));
  setPluginLinksHook(usePluginLinks);
  setPluginComponentHook(usePluginComponent);
  setPluginComponentsHook(usePluginComponents);
}
