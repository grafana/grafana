import { type PluginMeta } from '@grafana/data';
import {
  getBackendSrv,
  getPluginSettings as stableGetPluginSettings,
  getAppPluginHealth as stableGetAppPluginHealth,
  updateAppPluginSettings as stableUpdateAppPluginSettings,
  type HealthCheckResult,
  HealthStatus,
  isFetchError,
  callAppPluginProxy as stableCallAppPluginProxy,
} from '@grafana/runtime';

export async function getPluginSettings(pluginId: string, showErrorAlert = false): Promise<PluginMeta> {
  if (typeof stableGetPluginSettings === 'function') {
    return stableGetPluginSettings(pluginId, showErrorAlert);
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

interface CallArgs {
  pluginId: string;
  routePath: string;
  showErrorAlert?: boolean;
  apiVersion?: string;
}

export async function callAppPluginProxy<T = unknown>(args: CallArgs): Promise<T | undefined> {
  if (typeof stableCallAppPluginProxy === 'function') {
    return stableCallAppPluginProxy<T>(args);
  }

  return backwardsCompatibleCallAppPluginProxy<T>(args.pluginId, args.routePath, args.showErrorAlert);
}

function backwardsCompatibleCallAppPluginProxy<T = unknown>(
  pluginId: string,
  routePath: string,
  showErrorAlert = false
): Promise<T> {
  const options = { showErrorAlert, validatePath: true };

  return getBackendSrv()
    .get<T>(`/api/plugin-proxy/${pluginId}/${routePath}`, undefined, undefined, options)
    .catch((err) => {
      if (isFetchError(err) && (err.status === 401 || err.status === 403)) {
        err.isHandled = true;
        return Promise.reject(err);
      }

      return Promise.reject(err);
    });
}
