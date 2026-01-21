import { ReactNode, useMemo } from 'react';

import { DataSourceInstanceSettings, getDataSourceRef, LoadingState } from '@grafana/data';

import { getQueryRunnerFor } from '../../utils/utils';

import { PanelDataPaneNext } from './PanelDataPaneNext';
import { QueryEditorProvider } from './QueryEditorContext';

/**
 * Bridge component that subscribes to Scene state and provides it via React Context.
 * Wraps children with QueryEditorProvider so both sidebar and editor can access context.
 */
export function QueryEditorContextWrapper({
  dataPane,
  children,
}: {
  dataPane: PanelDataPaneNext;
  children: ReactNode;
}) {
  const { panelRef, datasource, dsSettings, dsError } = dataPane.useState();
  const panel = panelRef.resolve();
  const queryRunner = getQueryRunnerFor(panel);
  const queryRunnerState = queryRunner?.useState();

  const dsState = useMemo(
    () => ({
      datasource,
      dsSettings,
      dsError,
    }),
    [datasource, dsSettings, dsError]
  );

  const qrState = useMemo(
    () => ({
      queries: queryRunnerState?.queries ?? [],
      data: queryRunnerState?.data,
      isLoading: queryRunnerState?.data?.state === LoadingState.Loading,
    }),
    [queryRunnerState?.queries, queryRunnerState?.data]
  );

  const panelState = useMemo(
    () => ({
      panel,
    }),
    [panel]
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
    <QueryEditorProvider dsState={dsState} qrState={qrState} panelState={panelState} actions={actions}>
      {children}
    </QueryEditorProvider>
  );
}
