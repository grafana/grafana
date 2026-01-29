import { ReactNode, useMemo, useState } from 'react';

import { DataSourceInstanceSettings, getDataSourceRef, LoadingState } from '@grafana/data';
import { SceneDataTransformer } from '@grafana/scenes';
import { DataQuery, DataTransformerConfig } from '@grafana/schema';

import { getQueryRunnerFor } from '../../../utils/utils';
import { PanelDataPaneNext } from '../PanelDataPaneNext';

import { QueryEditorProvider } from './QueryEditorContext';
import { isDataTransformerConfig } from './utils';

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
  const [selectedQueryRefId, setSelectedQueryRefId] = useState<string | null>(null);
  const [selectedTransformationId, setSelectedTransformationId] = useState<string | null>(null);

  const transformations = useMemo(() => {
    if (panel.state.$data instanceof SceneDataTransformer) {
      return panel.state.$data.state.transformations;
    }
    return [];
  }, [panel]);

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
    return {
      panel,
      transformations,
    };
  }, [panel, transformations]);

  const selectedQuery = useMemo(() => {
    const queries = queryRunnerState?.queries ?? [];

    // If we have a selected query refId, try to find that query
    if (selectedQueryRefId) {
      const query = queries.find((q) => q.refId === selectedQueryRefId);
      if (query) {
        return query;
      }
    }

    // Otherwise, default to the first query if available
    return queries.length > 0 ? queries[0] : null;
  }, [queryRunnerState?.queries, selectedQueryRefId]);

  const selectedTransformation = useMemo(() => {
    // If we have a selected transformation id, try to find that transformation
    if (selectedTransformationId) {
      const transformation = transformations.find(
        (t): t is DataTransformerConfig => isDataTransformerConfig(t) && t.id === selectedTransformationId
      );
      if (transformation) {
        return transformation;
      }
    }

    return null;
  }, [transformations, selectedTransformationId]);

  const uiState = useMemo(
    () => ({
      selectedQuery,
      selectedTransformation,
      setSelectedQuery: (query: DataQuery | null) => {
        setSelectedQueryRefId(query?.refId ?? null);
        // Clear transformation selection when selecting a query
        setSelectedTransformationId(null);
      },
      setSelectedTransformation: (transformation: DataTransformerConfig | null) => {
        setSelectedTransformationId(transformation?.id ?? null);
        // Clear query selection when selecting a transformation
        setSelectedQueryRefId(null);
      },
    }),
    [selectedQuery, selectedTransformation]
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
