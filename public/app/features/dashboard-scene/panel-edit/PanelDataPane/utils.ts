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

/**
 * Checks if all datasources used in queries are frontend datasources (no backend)
 * Frontend datasources have meta.backend === false or undefined
 * Backend datasources have meta.backend === true
 * Defaults to backend if the type can't be determined for safety
 */
export function areAllDatasourcesFrontend(datasourceUid: string | undefined, queries: DataQuery[]): boolean {
  // The dashboard datasource is always FE
  if (datasourceUid === SHARED_DASHBOARD_QUERY) {
    return true;
  }

  if (!datasourceUid) {
    return false;
  }

  const mainDsSettings = getDataSourceSrv().getInstanceSettings(datasourceUid);
  if (!mainDsSettings) {
    return false;
  }

  // If its mixed we need to check all the datasources since there's no top level info if it's all FE or all BE
  if (mainDsSettings.meta.mixed === true) {
    const datasourceUids = new Set<string>();
    for (const query of queries) {
      if (query.datasource?.uid) {
        datasourceUids.add(query.datasource.uid);
      }
    }

    // If there are datasources in queries, check if any are backend
    if (datasourceUids.size > 0) {
      for (const uid of datasourceUids) {
        if (uid === SHARED_DASHBOARD_QUERY) {
          continue;
        }

        const dsSettings = getDataSourceSrv().getInstanceSettings(uid);
        if (!dsSettings) {
          return false;
        }

        if (dsSettings.meta.backend === true) {
          return false;
        }
      }
    }

    // If there are no datasources in queries, default to frontend since "Mixed" is technically a FE datasource
    return true;
  }

  // For non-mixed datasources, check the main datasource
  // Frontend datasources have meta.backend === false or undefined
  return mainDsSettings.meta.backend !== true;
}
