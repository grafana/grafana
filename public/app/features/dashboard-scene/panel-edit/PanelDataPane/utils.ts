import { getDataSourceSrv, isExpressionReference } from '@grafana/runtime';
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
  if (datasourceUid === SHARED_DASHBOARD_QUERY) {
    return false;
  }

  // A panel level datasource only answers this on its own when every query runs through it. V2
  // panels don't carry one unless the queries are mixed, and callers that infer it from the first
  // query can land on an expression ref, so both of those fall through to the queries below.
  if (datasourceUid && !isExpressionReference(datasourceUid)) {
    const mainDsSettings = getDataSourceSrv().getInstanceSettings(datasourceUid);
    if (mainDsSettings && !mainDsSettings.meta.mixed) {
      return mainDsSettings.meta.backend === true;
    }
  }

  // Expression queries resolve to settings without meta.backend, so they never count as backend.
  return queries?.some((query) => query.datasource?.uid && isBackendDatasource(query.datasource.uid)) ?? false;
}
