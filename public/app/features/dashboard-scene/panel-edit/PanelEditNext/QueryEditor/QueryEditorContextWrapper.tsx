import { ReactNode, useMemo, useState } from 'react';

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
  const [selectedCardRefId, setSelectedCardRefId] = useState<string | null>(null);

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

  const selectedCard = useMemo(() => {
    const queries = queryRunnerState?.queries ?? [];
    // If we have a selected refId, try to find that query
    if (selectedCardRefId) {
      const query = queries.find((q) => q.refId === selectedCardRefId);
      if (query) {
        return query;
      }
    }

    // Otherwise, default to the first query if available
    return queries.length > 0 ? queries[0] : null;
  }, [queryRunnerState?.queries, selectedCardRefId]);

  const uiState = useMemo(
    () => ({
      selectedCard,
      setSelectedCard: (query: DataQuery | null) => {
        setSelectedCardRefId(query?.refId ?? null);
      },
    }),
    [selectedCard]
  );

  const actions = useMemo(
    () => ({
      updateQueries: dataPane.updateQueries,
      updateSelectedQuery: (updatedQuery: DataQuery, originalRefId: string) => {
        dataPane.updateSelectedQuery(updatedQuery, originalRefId);
      },
      addQuery: dataPane.addQuery,
      deleteQuery: dataPane.deleteQuery,
      duplicateQuery: dataPane.duplicateQuery,
      runQueries: dataPane.runQueries,
      changeDataSource: (settings: DataSourceInstanceSettings, queryRefId: string) => {
        dataPane.changeDataSource(getDataSourceRef(settings), queryRefId);
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
