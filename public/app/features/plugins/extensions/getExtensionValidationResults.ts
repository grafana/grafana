import { PluginContextType } from '@grafana/data';

import * as errors from './errors';
import { ExtensionsLog, log } from './logs/log';
import { isGrafanaDevMode } from './utils';
import { isExtensionPointIdValid, isExtensionPointMetaInfoMissing } from './validators';

interface GetExtensionValidationResultsOptions {
  extensionPointId: string;
  isLoadingAppPlugins: boolean;
  pluginContext: PluginContextType | null;
}

interface ExtensionsValidationResult {
  isLoading: boolean;
  results: [];
}

type GetExtensionValidationResultsResult = {
  result: ExtensionsValidationResult | null;
  pointLog: ExtensionsLog;
};

export function getExtensionValidationResults({
  extensionPointId,
  isLoadingAppPlugins,
  pluginContext,
}: GetExtensionValidationResultsOptions): GetExtensionValidationResultsResult {
  const isInsidePlugin = Boolean(pluginContext);
  const isCoreGrafanaPlugin = pluginContext?.meta.module.startsWith('core:') ?? false;
  const pluginId = pluginContext?.meta.id ?? '';
  const pointLog = log.child({
    pluginId,
    extensionPointId,
  });

  // Don't show extensions if the extension-point id is invalid in DEV mode
  if (
    isGrafanaDevMode() &&
    !isExtensionPointIdValid({ extensionPointId, pluginId, isInsidePlugin, isCoreGrafanaPlugin, log: pointLog })
  ) {
    return { result: { isLoading: false, results: [] }, pointLog };
  }

  // Don't show extensions if the extension-point misses meta info (plugin.json) in DEV mode
  if (
    isGrafanaDevMode() &&
    !isCoreGrafanaPlugin &&
    pluginContext &&
    isExtensionPointMetaInfoMissing(extensionPointId, pluginContext)
  ) {
    pointLog.error(errors.EXTENSION_POINT_META_INFO_MISSING);
    return { result: { isLoading: false, results: [] }, pointLog };
  }

  if (isLoadingAppPlugins) {
    return { result: { isLoading: true, results: [] }, pointLog };
  }

  return { result: null, pointLog };
}
