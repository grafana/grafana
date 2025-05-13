import {
  setPluginComponentHook,
  setPluginComponentsHook,
  setPluginLinksHook,
  config,
  setPluginFunctionsHook,
} from '@grafana/runtime';
import { setGetObservablePluginComponents, setGetObservablePluginLinks } from '@grafana/runtime/internal';

import { contextSrv } from './core/services/context_srv';
import {
  getObservablePluginComponents,
  getObservablePluginLinks,
} from './features/plugins/extensions/getPluginExtensions';
import { usePluginComponent } from './features/plugins/extensions/usePluginComponent';
import { usePluginComponents } from './features/plugins/extensions/usePluginComponents';
import { usePluginFunctions } from './features/plugins/extensions/usePluginFunctions';
import { usePluginLinks } from './features/plugins/extensions/usePluginLinks';
import { getAppPluginsToAwait, getAppPluginsToPreload } from './features/plugins/extensions/utils';
import { preloadPlugins } from './features/plugins/pluginPreloader';

export const setupPluginHooks = () => {
  setPluginLinksHook(usePluginLinks);
  setPluginComponentHook(usePluginComponent);
  setPluginComponentsHook(usePluginComponents);
  setPluginFunctionsHook(usePluginFunctions);
  setGetObservablePluginLinks(getObservablePluginLinks);
  setGetObservablePluginComponents(getObservablePluginComponents);
};

export async function initPlugins() {
  // Do not pre-load apps if rendererDisableAppPluginsPreload is true and the request comes from the image renderer
  const skipAppPluginsPreload =
    config.featureToggles.rendererDisableAppPluginsPreload && contextSrv.user.authenticatedBy === 'render';
  if (contextSrv.user.orgRole !== '' && !skipAppPluginsPreload) {
    const appPluginsToAwait = getAppPluginsToAwait();
    const appPluginsToPreload = getAppPluginsToPreload();

    preloadPlugins(appPluginsToPreload);
    await preloadPlugins(appPluginsToAwait);
  }

  setupPluginHooks();
}
