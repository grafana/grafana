import { useAsync } from 'react-use';

import { type DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

import { getPanelScopedVars } from '../utils';

/**
 * Loads the datasource for a query. Falls back to the panel's datasource if the query doesn't
 * specify one. Returns `queryDsError` when the lookup throws so consumers can distinguish a
 * configuration gap (no datasource resolved) from an actual load failure.
 *
 * `panel` is forwarded as scene scope so section-scoped (row/tab) datasource variables resolve,
 * not just dashboard-level ones. See {@link getPanelScopedVars}.
 */
export function useQueryDatasource(
  query: DataQuery | null,
  panelDsSettings: DataSourceInstanceSettings | undefined,
  panel?: VizPanel
) {
  const { value, loading, error } = useAsync(async () => {
    if (!query) {
      return undefined;
    }

    let dsRef = query.datasource;

    if (!dsRef && panelDsSettings) {
      // Mixed is a meta-datasource that delegates to per-query datasources; Mixed-panel queries
      // normally specify their own. Fall back to the default for legacy/transition cases —
      // matches behavior in resolveNewQueryDatasource.
      if (panelDsSettings.meta.mixed) {
        const defaultDs = getDataSourceSrv().getInstanceSettings(config.defaultDatasource);
        dsRef = defaultDs ? getDataSourceRef(defaultDs) : undefined;
      } else {
        dsRef = getDataSourceRef(panelDsSettings);
      }
    }

    if (!dsRef) {
      return undefined;
    }

    const scopedVars = panel ? getPanelScopedVars(panel) : undefined;

    const queryDsSettings = getDataSourceSrv().getInstanceSettings(dsRef, scopedVars);
    if (!queryDsSettings) {
      throw new Error(`Datasource settings not found for ${JSON.stringify(dsRef)}`);
    }

    const queryDatasource = await getDataSourceSrv().get(dsRef, scopedVars);
    return { datasource: queryDatasource, dsSettings: queryDsSettings };
    // Narrow deps are intentional: widening to [query, panelDsSettings] would re-run on every
    // field change (SQL text, refId, hide flag), flickering `loading` and briefly clearing
    // `queryDsData` on every keystroke. Only datasource-identity changes should invalidate.
    // `panel` is omitted: its identity is stable for the editor's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    query?.refId,
    query?.datasource?.uid,
    query?.datasource?.type,
    panelDsSettings?.uid,
    panelDsSettings?.meta.mixed,
  ]);

  return {
    queryDsData: value ?? null,
    queryDsLoading: loading,
    queryDsError: error,
  };
}
