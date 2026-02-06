import { ReactNode, useCallback, useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import { v4 } from 'uuid';

import {
  DataSourceInstanceSettings,
  getDataSourceRef,
  LoadingState,
  standardTransformersRegistry,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneDataTransformer } from '@grafana/scenes';
import { DataQuery, DataTransformerConfig } from '@grafana/schema';
import { ExpressionQuery } from 'app/features/expressions/types';
import { QueryGroupOptions } from 'app/types/query';

import { getQueryRunnerFor } from '../../../utils/utils';
import { PanelDataPaneNext } from '../PanelDataPaneNext';

import { QueryEditorProvider } from './QueryEditorContext';
import { QueryOptionField, Transformation } from './types';
import { useQueryOptions } from './useQueryOptions';
import { getEditorType, isDataTransformerConfig } from './utils';

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
  const [isQueryOptionsOpen, setIsQueryOptionsOpen] = useState(false);
  const [focusedField, setFocusedField] = useState<QueryOptionField | null>(null);
  const [showingDatasourceHelp, setShowingDatasourceHelp] = useState(false);

  const transformations: Transformation[] = useMemo(() => {
    if (panel.state.$data instanceof SceneDataTransformer) {
      // Filter to only include DataTransformerConfig items (exclude CustomTransformerDefinition)
      const transformationList = panel.state.$data.state.transformations.filter((t): t is DataTransformerConfig =>
        isDataTransformerConfig(t)
      );

      const transformationsList: Transformation[] = transformationList.map((t) => {
        return {
          transformConfig: t,
          registryItem: standardTransformersRegistry.getIfExists(t.id),
          transformId: v4(),
        };
      });

      return transformationsList;
    }
    return [];
  }, [panel]);

  // NOTE: This is the datasource for the panel, not the query
  const dsState = useMemo(
    () => ({
      datasource,
      dsSettings,
      dsError,
    }),
    [datasource, dsSettings, dsError]
  );

  const queryError = useMemo(() => {
    return queryRunnerState?.data?.errors?.find(({ refId }) => refId === selectedQueryRefId);
  }, [queryRunnerState?.data?.errors, selectedQueryRefId]);

  const qrState = useMemo(
    () => ({
      queries: queryRunnerState?.queries ?? [],
      data: queryRunnerState?.data,
      isLoading: queryRunnerState?.data?.state === LoadingState.Loading,
      queryError,
    }),
    [queryRunnerState?.queries, queryRunnerState?.data, queryError]
  );

  const panelState = useMemo(() => {
    return {
      panel,
      transformations,
    };
  }, [panel, transformations]);

  const queryOptions = useQueryOptions({ panel, queryRunner, dsSettings });

  // Callbacks to open/close sidebar with optional focus
  const openSidebar = useCallback((focusField?: QueryOptionField) => {
    setIsQueryOptionsOpen(true);
    if (focusField) {
      setFocusedField(focusField);
    }
  }, []);

  const closeSidebar = useCallback(() => {
    setIsQueryOptionsOpen(false);
    setFocusedField(null);
  }, []);

  const selectedQuery = useMemo(() => {
    const queries = queryRunnerState?.queries ?? [];

    // If we have a selected query refId, try to find that query
    if (selectedQueryRefId) {
      const query = queries.find((q) => q.refId === selectedQueryRefId);
      if (query) {
        return query;
      }
    }

    // If a transformation is selected, don't select any query
    if (selectedTransformationId) {
      return null;
    }

    // Otherwise, default to the first query if available
    return queries.length > 0 ? queries[0] : null;
  }, [queryRunnerState?.queries, selectedQueryRefId, selectedTransformationId]);

  const selectedTransformation = useMemo(() => {
    // If we have a selected transformation id, try to find that transformation
    if (selectedTransformationId) {
      const transformation = transformations.find((t) => t.transformId === selectedTransformationId);
      if (transformation) {
        return transformation;
      }
    }

    return null;
  }, [transformations, selectedTransformationId]);

  const { value: selectedQueryDsData, loading: selectedQueryDsLoading } = useAsync(async () => {
    if (!selectedQuery?.datasource) {
      return undefined;
    }

    try {
      const dsSettings = getDataSourceSrv().getInstanceSettings(selectedQuery.datasource);
      const datasource = await getDataSourceSrv().get(selectedQuery.datasource);
      return { datasource, dsSettings };
    } catch (err) {
      console.error('Failed to load datasource for selected query:', err);
      return undefined;
    }
  }, [selectedQuery?.datasource?.uid, selectedQuery?.datasource?.type]);

  const uiState = useMemo(
    () => ({
      selectedQuery,
      selectedTransformation,
      setSelectedQuery: (query: DataQuery | ExpressionQuery | null) => {
        setSelectedQueryRefId(query?.refId ?? null);
        // Clear transformation selection when selecting a query
        setSelectedTransformationId(null);
        // Reset datasource help when switching queries
        setShowingDatasourceHelp(false);
      },
      setSelectedTransformation: (transformation: Transformation | null) => {
        setSelectedTransformationId(transformation?.transformId ?? null);
        // Clear query selection when selecting a transformation
        setSelectedQueryRefId(null);
      },
      queryOptions: {
        options: queryOptions,
        isQueryOptionsOpen,
        openSidebar,
        closeSidebar,
        focusedField,
      },
      selectedQueryDsData: selectedQueryDsData ?? null,
      selectedQueryDsLoading,
      showingDatasourceHelp,
      toggleDatasourceHelp: () => setShowingDatasourceHelp((prev) => !prev),
      cardType: getEditorType(selectedQuery || selectedTransformation),
    }),
    [
      selectedQuery,
      selectedTransformation,
      queryOptions,
      isQueryOptionsOpen,
      openSidebar,
      closeSidebar,
      focusedField,
      selectedQueryDsData,
      selectedQueryDsLoading,
      showingDatasourceHelp,
    ]
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
      toggleQueryHide: dataPane.toggleQueryHide,
      runQueries: dataPane.runQueries,
      changeDataSource: (settings: DataSourceInstanceSettings, queryRefId: string) => {
        dataPane.changeDataSource(getDataSourceRef(settings), queryRefId);
      },
      onQueryOptionsChange: (options: QueryGroupOptions) => dataPane.onQueryOptionsChange(options),
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
