import { type DataSourceInstanceSettings } from '@grafana/data';

import { config } from '../config';
import { getFeatureFlagClient } from '../internal/openFeature';

import { isDatasourceAuthCompatible } from './qscheck';

/**
 * Whether `endpoint` calls for this datasource go to the datasource API server (`/apis/...`) instead of the
 * legacy `/api/datasources/uid/...` routes. Reads only instance settings, so callers can decide without loading
 * the plugin.
 */
export function supportsDatasourceApi(endpoint: 'resources' | 'health', settings: DataSourceInstanceSettings): boolean {
  // @ts-expect-error featuremgmt/registry.go does not support object feature flags yet
  const allowedTypes = getFeatureFlagClient().getObjectValue('datasources.apiserver.fe-allowed-types', {
    resources: [],
    health: [],
  });
  if (!allowedTypes || typeof allowedTypes !== 'object' || Array.isArray(allowedTypes)) {
    return false;
  }
  const pluginIds = allowedTypes[endpoint];
  return (
    Array.isArray(pluginIds) &&
    (pluginIds.includes('*') || pluginIds.includes(settings.meta?.id ?? settings.type)) &&
    isDatasourceAuthCompatible(settings)
  );
}

/** Health check URL for the datasource, on the route `supportsDatasourceApi('health', settings)` selects. */
export function getHealthCheckUrl(settings: DataSourceInstanceSettings): string {
  if (supportsDatasourceApi('health', settings)) {
    return `/apis/${settings.meta?.id ?? settings.type}.datasource.grafana.app/v0alpha1/namespaces/${config.namespace}/datasources/${settings.uid}/health`;
  }
  return `/api/datasources/uid/${settings.uid}/health`;
}
