import { config } from '@grafana/runtime';

export function isAngularDatasourcePlugin(dsUid?: string): boolean {
  if (!dsUid) {
    return false;
  }
  return Object.entries(config.datasources).some(([_, ds]) => {
    return ds.uid === dsUid && ds.angularDetected;
  });
}
