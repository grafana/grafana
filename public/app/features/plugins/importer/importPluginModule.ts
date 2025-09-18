import { DEFAULT_LANGUAGE } from '@grafana/i18n';
import { getResolvedLanguage } from '@grafana/i18n/internal';
import { config } from '@grafana/runtime';

import builtInPlugins from '../built_in_plugins';
import { registerPluginInfoInCache } from '../loader/pluginInfoCache';
import { SystemJS } from '../loader/systemjs';
import { resolveModulePath } from '../loader/utils';
import { importPluginModuleInSandbox } from '../sandbox/sandboxPluginLoader';
import { shouldLoadPluginInFrontendSandbox } from '../sandbox/sandboxPluginLoaderRegistry';
import { pluginsLogger } from '../utils';

import { addTranslationsToI18n } from './addTranslationsToI18n';
import { PluginImportInfo } from './types';

export async function importPluginModule({
  path,
  pluginId,
  loadingStrategy,
  version,
  moduleHash,
  translations,
}: PluginImportInfo): Promise<System.Module> {
  if (version) {
    registerPluginInfoInCache({ path, version, loadingStrategy });
  }

  // Add locales to i18n for a plugin if the feature toggle is enabled and the plugin has locales
  if (translations) {
    await addTranslationsToI18n({
      resolvedLanguage: getResolvedLanguage(),
      fallbackLanguage: DEFAULT_LANGUAGE,
      pluginId,
      translations,
    });
  }

  const builtIn = builtInPlugins[path];
  if (builtIn) {
    // for handling dynamic imports
    if (typeof builtIn === 'function') {
      return await builtIn();
    } else {
      return builtIn;
    }
  }

  const modulePath = resolveModulePath(path);

  // inject integrity hash into SystemJS import map
  if (config.featureToggles.pluginsSriChecks) {
    const resolvedModule = System.resolve(modulePath);
    const integrityMap = System.getImportMap().integrity;

    if (moduleHash && integrityMap && !integrityMap[resolvedModule]) {
      SystemJS.addImportMap({
        integrity: {
          [resolvedModule]: moduleHash,
        },
      });
    }
  }

  // the sandboxing environment code cannot work in nodejs and requires a real browser
  if (await shouldLoadPluginInFrontendSandbox({ pluginId })) {
    return importPluginModuleInSandbox({ pluginId });
  }

  return SystemJS.import(modulePath).catch((e) => {
    let error = new Error('Could not load plugin: ' + e);
    console.error(error);
    pluginsLogger.logError(error, {
      path,
      pluginId,
      pluginVersion: version ?? '',
      expectedHash: moduleHash ?? '',
      loadingStrategy: loadingStrategy.toString(),
      sriChecksEnabled: String(Boolean(config.featureToggles.pluginsSriChecks)),
      newPluginLoadingEnabled: String(Boolean(config.featureToggles.enablePluginImporter)),
    });
    throw error;
  });
}
