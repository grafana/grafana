import { type PluginMeta } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import {
  getPluginSettings as runtimeGetPluginSettings,
  updateAppPluginSettings as runtimeUpdateAppPluginSettings,
} from '@grafana/runtime/unstable';

export function getPluginSettings(
  pluginId: string,
  showErrorAlert?: boolean,
  getFn: typeof runtimeGetPluginSettings = runtimeGetPluginSettings
): Promise<PluginMeta> {
  if (!getFn || typeof getFn !== 'function') {
    return backwardsCompatibleGetPluginSettings(pluginId, showErrorAlert);
  }

  return runtimeGetPluginSettings(pluginId, showErrorAlert);
}

function backwardsCompatibleGetPluginSettings(pluginId: string, showErrorAlert = false): Promise<PluginMeta> {
  return getBackendSrv().get(`/api/plugins/${pluginId}/settings`, undefined, undefined, {
    showErrorAlert,
    validatePath: true,
  });
}

export function updatePluginSettings(
  pluginId: string,
  data: Partial<PluginMeta>,
  updateFn: typeof runtimeUpdateAppPluginSettings = runtimeUpdateAppPluginSettings
): Promise<PluginMeta> {
  if (!updateFn || typeof updateFn !== 'function') {
    return backwardsCompatibleUpdatePluginSettings(pluginId, data);
  }

  return runtimeUpdateAppPluginSettings(pluginId, data);
}

async function backwardsCompatibleUpdatePluginSettings(
  pluginId: string,
  data: Partial<PluginMeta>
): Promise<PluginMeta> {
  await getBackendSrv().post(`/api/plugins/${pluginId}/settings`, data, { validatePath: true });
  return backwardsCompatibleGetPluginSettings(pluginId);
}
