import { PluginContextType } from '@grafana/data';

import * as errors from './errors';
import { ExtensionsLog } from './logs/log';
import { isGrafanaDevMode } from './utils';
import { isExtensionPointIdValid, isExtensionPointMetaInfoMissing } from './validators';

interface ValidateExtensionPointOptions {
  extensionPointId: string;
  isLoadingAppPlugins: boolean;
  pluginContext: PluginContextType | null;
  extensionPointLog: ExtensionsLog;
}

interface ValidateExtensionPoint {
  isLoading: boolean;
}

type ValidateExtensionPointResult = {
  result: ValidateExtensionPoint | null;
};

export function validateExtensionPoint({
  extensionPointId,
  isLoadingAppPlugins,
  pluginContext,
  extensionPointLog,
}: ValidateExtensionPointOptions): ValidateExtensionPointResult {
  const isInsidePlugin = Boolean(pluginContext);
  const isCoreGrafanaPlugin = pluginContext?.meta.module.startsWith('core:') ?? false;
  const pluginId = pluginContext?.meta.id ?? '';

  // Don't show extensions if the extension-point id is invalid in DEV mode
  if (
    isGrafanaDevMode() &&
    !isExtensionPointIdValid({
      extensionPointId,
      pluginId,
      isInsidePlugin,
      isCoreGrafanaPlugin,
      log: extensionPointLog,
    })
  ) {
    return { result: { isLoading: false } };
  }

  // Don't show extensions if the extension-point misses meta info (plugin.json) in DEV mode
  if (
    isGrafanaDevMode() &&
    !isCoreGrafanaPlugin &&
    pluginContext &&
    isExtensionPointMetaInfoMissing(extensionPointId, pluginContext)
  ) {
    extensionPointLog.error(errors.EXTENSION_POINT_META_INFO_MISSING);
    return { result: { isLoading: false } };
  }

  if (isLoadingAppPlugins) {
    return { result: { isLoading: true } };
  }

  return { result: null };
}
