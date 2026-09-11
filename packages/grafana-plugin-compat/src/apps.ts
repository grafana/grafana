import { type PluginMeta } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import {
  getPluginSettings as runtimeGetPluginSettings,
  updateAppPluginSettings as runtimeUpdateAppPluginSettings,
} from '@grafana/runtime/unstable';

export function getPluginSettings(pluginId: string, showErrorAlert = false): Promise<PluginMeta> {
  if (runtimeGetPluginSettings && typeof runtimeGetPluginSettings === 'function') {
    return runtimeGetPluginSettings(pluginId, showErrorAlert);
  }

  return backwardsCompatibleGetPluginSettings(pluginId, showErrorAlert);
}

function backwardsCompatibleGetPluginSettings(pluginId: string, showErrorAlert = false): Promise<PluginMeta> {
  return getBackendSrv().get(`/api/plugins/${pluginId}/settings`, undefined, undefined, {
    showErrorAlert,
    validatePath: true,
  });
}

export function updatePluginSettings(pluginId: string, data: Partial<PluginMeta>): Promise<PluginMeta> {
  if (runtimeUpdateAppPluginSettings || typeof runtimeUpdateAppPluginSettings === 'function') {
    return runtimeUpdateAppPluginSettings(pluginId, data);
  }

  return backwardsCompatibleUpdatePluginSettings(pluginId, data);
}

async function backwardsCompatibleUpdatePluginSettings(
  pluginId: string,
  data: Partial<PluginMeta>
): Promise<PluginMeta> {
  await getBackendSrv().post(`/api/plugins/${pluginId}/settings`, data, { validatePath: true });
  return backwardsCompatibleGetPluginSettings(pluginId);
}
