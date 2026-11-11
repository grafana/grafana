import { type AppPluginConfig, type DataSourcePluginMeta, type PanelPluginMeta } from '@grafana/data';

import { config } from '../config';

export function getApiVersion(): string {
  return 'v0alpha1';
}

export function getNamespace(): string {
  return config.namespace;
}

export function isAuthError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null && 'status' in err && (err.status === 403 || err.status === 401)) {
    return true;
  }

  return false;
}

export function getLegacyCacheKey(pluginId: string, _showErrorAlert = false) {
  return `getLegacySettings-${pluginId}`;
}

export function getCacheKey(pluginId: string, _showErrorAlert = false) {
  return `getAppPluginSettings-${pluginId}`;
}

const pluginIdPattern = /^[0-9a-z]+\-([0-9a-z]+\-)?(app|panel|datasource)$/;

export function validatePluginId(pluginId: string): boolean {
  if (!pluginId) {
    return false;
  }

  return pluginIdPattern.test(pluginId);
}

interface ValidateArgs {
  pluginId?: string;
  apps?: AppPluginConfig[];
  datasources?: DataSourcePluginMeta[];
  panels?: PanelPluginMeta[];
}

export function isValidPluginId({ pluginId, apps = [], datasources = [], panels = [] }: ValidateArgs): boolean {
  if (!pluginId) {
    return false;
  }

  if (validatePluginId(pluginId)) {
    return true;
  }

  const app = apps.find((a) => a.id === pluginId);
  if (app) {
    return true;
  }

  const datasource = datasources.find((d) => d.id === pluginId);
  if (datasource) {
    return true;
  }

  const panel = panels.find((p) => p.id === pluginId);
  if (panel) {
    return true;
  }

  return false;
}

const apiVersionPattern = /^v[0-9]+(?:(?:alpha|beta)[0-9]+)?$/;

export function isValidApiVersion(apiVersion?: string): boolean {
  if (!apiVersion) {
    return false;
  }

  return apiVersionPattern.test(apiVersion);
}
