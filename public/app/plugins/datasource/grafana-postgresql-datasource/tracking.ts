import type { DataSourcePluginMeta, TestDataSourceResponse } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

export const trackHealthCheck = (res: TestDataSourceResponse, meta: DataSourcePluginMeta) => {
  if ((res?.status || '').toLowerCase() === 'success') {
    return;
  }
  let properties: Record<string, any> = {
    'plugin.id': meta?.id || 'unknown',
    'plugin.version': meta?.info?.version || 'unknown',
    'datasource.healthcheck.status': res?.status || 'unknown',
    'datasource.healthcheck.message': res?.message || 'unknown',
  };
  console.error(`Health check failed. ${res.message}.`, JSON.stringify({ res }));
  reportInteraction('plugin_health_check_completed', properties);
};
