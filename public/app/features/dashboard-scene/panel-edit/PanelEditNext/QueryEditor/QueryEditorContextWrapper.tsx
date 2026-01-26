import { ReactNode, useEffect, useMemo, useState } from 'react';

import { DataSourceInstanceSettings, getDataSourceRef, LoadingState } from '@grafana/data';
import { CustomTransformerDefinition, SceneDataTransformer } from '@grafana/scenes';
import { DataQuery, DataTransformerConfig } from '@grafana/schema';

import { getQueryRunnerFor } from '../../../utils/utils';
import { PanelDataPaneNext } from '../PanelDataPaneNext';

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
  const [selectedQuery, setSelectedQuery] = useState<DataQuery | null>(null);
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

  const panelState = useMemo(() => {
    let transformations: Array<DataTransformerConfig | CustomTransformerDefinition> = [];

    if (panel.state.$data instanceof SceneDataTransformer) {
      transformations = panel.state.$data.state.transformations;
    }

    return {
      panel,
      transformations,
    };
  }, [panel]);

  useEffect(() => {
    const queries = queryRunnerState?.queries ?? [];
    if (queries.length > 0) {
      setSelectedQuery(queries[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uiState = useMemo(
    () => ({
      selectedQuery,
      setSelectedQuery,
    }),
    [selectedQuery]
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
    <QueryEditorProvider
      dsState={dsState}
      qrState={qrState}
      panelState={panelState}
      uiState={uiState}
      actions={actions}
    >
      {children}
    </QueryEditorProvider>
  );
}
