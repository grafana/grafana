import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

export function scrollToQueryRow(refId: string) {
  // Query rows use uniqueId(refId + '_') for their internal id
  // The aria-controls attribute will be like "A_1" for refId "A"
  // So we need to search for aria-controls starting with "refId_"
  const queryRowHeader = document.querySelector(`[aria-controls^="${refId}_"]`);

  if (queryRowHeader) {
    // Find the parent query row wrapper
    const queryRow = queryRowHeader.closest('[data-testid="query-editor-row"]');

    if (queryRow instanceof HTMLElement) {
      queryRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

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
