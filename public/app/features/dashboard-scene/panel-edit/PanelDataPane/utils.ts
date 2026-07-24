import { getDataSourceSrv } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

function isBackendDatasource(uid: string): boolean {
  if (uid === SHARED_DASHBOARD_QUERY) {
    return false;
  }
  const settings = getDataSourceSrv().getInstanceSettings(uid);
  return settings?.meta.backend === true;
}

/**
 * Checks if there's at least one backend datasource available in the panel
 * Backend datasources have meta.backend === true
 */
export function hasBackendDatasource({
  datasourceUid,
  queries,
}: {
  datasourceUid: string | undefined;
  queries?: DataQuery[];
}): boolean {
  if (!datasourceUid || datasourceUid === SHARED_DASHBOARD_QUERY) {
    return false;
  }

  const mainDsSettings = getDataSourceSrv().getInstanceSettings(datasourceUid);
  if (!mainDsSettings) {
    return false;
  }

  // For mixed datasource, check if any query uses a backend datasource
  if (mainDsSettings.meta.mixed && queries) {
    return queries.some((query) => query.datasource?.uid && isBackendDatasource(query.datasource.uid));
  }

  // For non-mixed, check the main datasource
  return mainDsSettings.meta.backend === true;
}
