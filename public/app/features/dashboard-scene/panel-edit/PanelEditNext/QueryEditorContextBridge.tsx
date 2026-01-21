import { ReactNode, useMemo } from 'react';

import { DataSourceInstanceSettings, getDataSourceRef, LoadingState } from '@grafana/data';

import { getQueryRunnerFor } from '../../utils/utils';

import { PanelDataPaneNext } from './PanelDataPaneNext';
import { QueryEditorProvider } from './QueryEditorContext';

/**
 * Bridge component that subscribes to Scene state and provides it via React Context.
 * Wraps children with QueryEditorProvider so both sidebar and editor can access context.
 */
export function QueryEditorContextBridge({ dataPane, children }: { dataPane: PanelDataPaneNext; children: ReactNode }) {
  const { panelRef, datasource, dsSettings, error } = dataPane.useState();
  const panel = panelRef.resolve();
  const queryRunner = getQueryRunnerFor(panel);
  const queryRunnerState = queryRunner?.useState();

  const state = useMemo(
    () => ({
      panel,
      datasource,
      dsSettings,
      queries: queryRunnerState?.queries ?? [],
      data: queryRunnerState?.data,
      isLoading: queryRunnerState?.data?.state === LoadingState.Loading,
      error,
    }),
    [panel, datasource, dsSettings, queryRunnerState?.queries, queryRunnerState?.data, error]
  );

  const actions = useMemo(
    () => ({
      updateQueries: dataPane.updateQueries,
      addQuery: dataPane.addQuery,
      deleteQuery: dataPane.deleteQuery,
      duplicateQuery: dataPane.duplicateQuery,
      runQueries: dataPane.runQueries,
      changeDataSource: (settings: DataSourceInstanceSettings) => {
        dataPane.changeDataSource(getDataSourceRef(settings));
      },
    }),
    [dataPane]
  );

  return (
    <QueryEditorProvider state={state} actions={actions}>
      {children}
    </QueryEditorProvider>
  );
}
