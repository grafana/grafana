import { compare } from 'fast-json-patch';

import { PluginType, type PluginMeta } from '@grafana/data';

import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { getCachedPromiseWithArgs } from '../../utils/getCachedPromise';
import { getBackendSrv } from '../backendSrv';
import { getPluginMetaFromCache, refetchPluginMeta } from '../pluginMeta/plugins';

import { logPluginSettingsError, logPluginSettingsWarning } from './logging';
import { getSettingsMapper } from './mappers/mappers';
import { inlineSecureValuesMapper, settingsSpecMapper } from './mappers/v0alpha1SettingsMapper';
import { type Settings as v0alpha1Settings } from './types';

function getApiVersion(): string {
  return 'v0alpha1';
}

function isAuthError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null && 'status' in err && (err.status === 403 || err.status === 401)) {
    return true;
  }

  return false;
}

function getLegacySettings(pluginId: string, showErrorAlert?: boolean): Promise<PluginMeta | null> {
  const options = showErrorAlert ? { showErrorAlert, validatePath: true } : { validatePath: true };

  return getBackendSrv()
    .get(`/api/plugins/${pluginId}/settings`, undefined, undefined, options)
    .catch((err) => {
      // User does not have access to plugin
      if (isAuthError(err)) {
        err.isHandled = true;
        return Promise.reject(err);
      }

      return Promise.reject(new Error('Unknown Plugin', { cause: err }));
    });
}

function updateLegacySettings(id: string, data: Partial<PluginMeta>): Promise<void> {
  return getBackendSrv().post<void>(`/api/plugins/${id}/settings`, data, { validatePath: true });
}

function getAppPluginSettings(pluginId: string, showErrorAlert?: boolean): Promise<v0alpha1Settings> {
  const options = showErrorAlert ? { showErrorAlert, validatePath: true } : { validatePath: true };

  return getBackendSrv()
    .get<v0alpha1Settings>(
      `/apis/${pluginId}.grafana.app/${getApiVersion()}/namespaces/${config.namespace}/settings/${pluginId}`,
      undefined,
      undefined,
      options
    )
    .catch((err) => {
      // User does not have access to plugin
      if (isAuthError(err)) {
        err.isHandled = true;
        return Promise.reject(err);
      }

      return Promise.reject(new Error('Unknown Plugin', { cause: err }));
    });
}

async function updateAppPluginSettings(pluginId: string, data: Partial<PluginMeta>): Promise<v0alpha1Settings> {
  const spec = settingsSpecMapper(data);
  const secure = inlineSecureValuesMapper(data);
  const update = {
    apiVersion: `${pluginId}.grafana.app/${getApiVersion()}`,
    kind: 'Settings',
    spec,
    secure,
  };

  const { metadata, ...stored } = await refetchCachedAppSettings(pluginId, false);
  const patch = compare(stored, update);

  const updated = await getBackendSrv().patch<v0alpha1Settings>(
    `/apis/${pluginId}.grafana.app/${getApiVersion()}/namespaces/${config.namespace}/settings/${pluginId}`,
    patch,
    { validatePath: true }
  );

  return updated;
}

export async function getPluginSettings(pluginId: string, showErrorAlert = false): Promise<PluginMeta | null> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.UseMTPluginSettings, false)) {
    return getCachedLegacySettings(pluginId, showErrorAlert);
  }

  const meta = await getPluginMetaFromCache(pluginId);
  if (!meta || meta.spec.pluginJson.type !== 'app') {
    return getCachedLegacySettings(pluginId, showErrorAlert);
  }

  const settings = await getCachedAppSettings(pluginId, showErrorAlert);
  const mapper = getSettingsMapper();
  return mapper(meta.spec, settings);
}

export async function refetchPluginSettings(pluginId: string): Promise<PluginMeta | null> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.UseMTPluginSettings, false)) {
    return refetchCachedLegacySettings(pluginId, false);
  }

  const meta = await refetchPluginMeta(pluginId);
  if (!meta || meta.spec.pluginJson.type !== 'app') {
    return refetchCachedLegacySettings(pluginId, false);
  }

  const settings = await refetchCachedAppSettings(pluginId, false);
  const mapper = getSettingsMapper();
  return mapper(meta.spec, settings);
}

export async function updatePluginSettings(pluginId: string, data: Partial<PluginMeta>): Promise<PluginMeta | null> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.UseMTPluginSettings, false)) {
    await updateLegacySettings(pluginId, data);
    return refetchCachedLegacySettings(pluginId, false);
  }

  const meta = await refetchPluginMeta(pluginId);
  if (!meta || meta.spec.pluginJson.type !== 'app') {
    await updateLegacySettings(pluginId, data);
    return refetchCachedLegacySettings(pluginId, false);
  }

  const updated = await updateAppPluginSettings(pluginId, data);
  const mapper = getSettingsMapper();
  return mapper(meta.spec, updated);
}

export async function getAppPluginEnabled(pluginId: string): Promise<boolean> {
  const app = await getPluginSettings(pluginId);
  if (!app) {
    return false;
  }

  return app.type === PluginType.app && Boolean(app.enabled);
}

/**
 * Check if an app plugin is installed and enabled.
 * @param pluginId - The id of the app plugin.
 * @returns True if the app plugin is installed and enabled, false otherwise.
 */
export async function isAppPluginEnabled(pluginId: string): Promise<boolean> {
  try {
    const enabled = await getAppPluginEnabled(pluginId);
    return enabled;
  } catch (error) {
    if (isAuthError(error)) {
      logPluginSettingsWarning(`isAppPluginEnabled: failed because auth denied`, pluginId);
    } else {
      logPluginSettingsError(`isAppPluginEnabled failed for plugin with id ${pluginId}`, error);
    }
  }
  return false;
}

const getCachedLegacySettings = getCachedPromiseWithArgs(
  getLegacySettings,
  {},
  (pluginId, _showErrorAlert) => `getLegacySettings-${pluginId}`
);

const refetchCachedLegacySettings = getCachedPromiseWithArgs(
  getLegacySettings,
  { invalidate: true },
  (pluginId, _showErrorAlert) => `getLegacySettings-${pluginId}`
);

const getCachedAppSettings = getCachedPromiseWithArgs(
  getAppPluginSettings,
  {},
  (pluginId, _showErrorAlert) => `getAppPluginSettings-${pluginId}`
);

const refetchCachedAppSettings = getCachedPromiseWithArgs(
  getAppPluginSettings,
  { invalidate: true },
  (pluginId, _showErrorAlert) => `getAppPluginSettings-${pluginId}`
);
