import { DEFAULT_LANGUAGE } from '@grafana/i18n';
import { getResolvedLanguage } from '@grafana/i18n/internal';
import { config } from '@grafana/runtime';
import { getLogger } from '@grafana/runtime/unstable';

import builtInPlugins, { isBuiltinPluginPath } from '../built_in_plugins';
import { registerPluginInfoInCache } from '../loader/pluginInfoCache';
import { classifyPluginLoadError, PluginLoadError, type PluginLoadErrorInfo } from '../loader/pluginLoadError';
import { SystemJS } from '../loader/systemjs';
import { resolveModulePath } from '../loader/utils';
import { shouldLoadPluginInFrontendSandbox } from '../sandbox/sandboxPluginLoaderRegistry';

import { addTranslationsToI18n } from './addTranslationsToI18n';
import { type PluginImportInfo } from './types';

export async function importPluginModule({
  path,
  pluginId,
  pluginType,
  loadingStrategy,
  version,
  moduleHash,
  translations,
  hasUpdate,
  pluginName,
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

  if (isBuiltinPluginPath(path)) {
    const builtIn = builtInPlugins[path];
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
    // Loaded on demand: the near-membrane runtime behind this is large and most installs
    // never sandbox a plugin, so it should not be in the initial bundle.
    const { importPluginModuleInSandbox } = await import(
      /* webpackChunkName: "pluginSandbox" */ '../sandbox/sandboxPluginLoader'
    );
    return importPluginModuleInSandbox({ pluginId });
  }

  return SystemJS.import(modulePath).catch((e: unknown) => {
    let errorMessage = 'Could not load plugin';
    if (hasUpdate) {
      errorMessage = `Could not load plugin. Updating the "${pluginName}" plugin to the latest version may fix the problem.`;
    }
    const errorInfo = classifyPluginLoadError(e);
    const error = new PluginLoadError(errorMessage, { cause: e, ...errorInfo });
    const originalErrorMessage = e instanceof Error ? e.message : String(e);
    console.error(error);
    getLogger('features.plugins').logError(error, {
      path,
      pluginId,
      pluginVersion: version ?? '',
      expectedHash: moduleHash ?? '',
      loadingStrategy: loadingStrategy.toString(),
      sriChecksEnabled: String(Boolean(config.featureToggles.pluginsSriChecks)),
      originalErrorMessage,
      originalErrorStack: e instanceof Error ? (e.stack ?? '') : '',
      systemJSOriginalErr: originalErrorMessage,
      pluginType,
      ...toLogContext(errorInfo),
    });
    throw error;
  });
}

function toLogContext({ errorType, httpStatusSource, httpStatus, failedUrl, chunkErrorType }: PluginLoadErrorInfo) {
  return {
    errorType,
    httpStatusSource,
    ...(httpStatus && { httpStatus: String(httpStatus) }),
    ...(failedUrl && { failedUrl }),
    ...(chunkErrorType && { chunkErrorType }),
  };
}
