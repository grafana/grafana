import { type PluginMeta } from '@grafana/data';
import {
  getBackendSrv,
  getPluginSettings as stableGetPluginSettings,
  getAppPluginHealth as stableGetAppPluginHealth,
  updateAppPluginSettings as stableUpdateAppPluginSettings,
  type HealthCheckResult,
  HealthStatus,
  isFetchError,
} from '@grafana/runtime';
import {
  getPluginSettings as unstableGetPluginSettings,
  updateAppPluginSettings as unstableUpdateAppPluginSettings,
} from '@grafana/runtime/unstable';

export async function getPluginSettings(pluginId: string, showErrorAlert = false): Promise<PluginMeta> {
  if (typeof stableGetPluginSettings === 'function') {
    return stableGetPluginSettings(pluginId, showErrorAlert);
  }

  if (typeof unstableGetPluginSettings === 'function') {
    return unstableGetPluginSettings(pluginId, showErrorAlert);
  }

  return backwardsCompatibleGetPluginSettings(pluginId, showErrorAlert);
}

async function backwardsCompatibleGetPluginSettings(pluginId: string, showErrorAlert = false): Promise<PluginMeta> {
  return getBackendSrv().get(`/api/plugins/${pluginId}/settings`, undefined, undefined, {
    showErrorAlert,
    validatePath: true,
  });
}

export async function updateAppPluginSettings(pluginId: string, data: Partial<PluginMeta>): Promise<PluginMeta> {
  if (typeof stableUpdateAppPluginSettings === 'function') {
    return stableUpdateAppPluginSettings(pluginId, data);
  }

  if (typeof unstableUpdateAppPluginSettings === 'function') {
    return unstableUpdateAppPluginSettings(pluginId, data);
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

export async function getAppPluginHealth(
  pluginId: string,
  showErrorAlert = false,
  apiVersion?: string
): Promise<HealthCheckResult | undefined> {
  if (typeof stableGetAppPluginHealth === 'function') {
    return stableGetAppPluginHealth(pluginId, showErrorAlert, apiVersion);
  }

  return backwardsCompatibleGetAppPluginHealth(pluginId, showErrorAlert);
}

function isLegacyUnhealthyHealthCheckError(err: unknown): boolean {
  return (
    isFetchError<HealthCheckResult>(err) &&
    err.status === 400 &&
    (err.data?.status === HealthStatus.Error || err.data?.status === HealthStatus.Unknown)
  );
}

async function backwardsCompatibleGetAppPluginHealth(
  pluginId: string,
  showErrorAlert = false
): Promise<HealthCheckResult> {
  return getBackendSrv()
    .get<HealthCheckResult>(`/api/plugins/${pluginId}/health`, undefined, undefined, {
      showErrorAlert,
      validatePath: true,
    })
    .catch((err) => {
      if (isFetchError(err) && (err.status === 401 || err.status === 403)) {
        err.isHandled = true;
        return Promise.reject(err);
      }

      if (isLegacyUnhealthyHealthCheckError(err)) {
        return err.data;
      }

      return Promise.reject(err);
    });
}
