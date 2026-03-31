import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { type DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { SceneDataTransformer } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { type ExpressionQuery } from 'app/features/expressions/types';
import { type QueryGroupOptions } from 'app/types/query';

import { getQueryRunnerFor } from '../../../utils/utils';
import { type PanelDataPaneNext } from '../PanelDataPaneNext';

import {
  type PendingExpression,
  type PendingSavedQuery,
  type PendingTransformation,
  QueryEditorProvider,
} from './QueryEditorContext';
import { useAlertRulesForPanel } from './hooks/useAlertRulesForPanel';
import { usePendingExpression } from './hooks/usePendingExpression';
import { usePendingTransformation } from './hooks/usePendingTransformation';
import { useQueryOptions } from './hooks/useQueryOptions';
import { useSelectedCard } from './hooks/useSelectedCard';
import { useSelectedQueryDatasource } from './hooks/useSelectedQueryDatasource';
import { useTransformations } from './hooks/useTransformations';
import { type AlertRule, type QueryOptionField, type Transformation } from './types';
import { getEditorType, getTransformId } from './utils';

/**
 * Keeps query selection stable across refId renames.
 * When the currently selected query is renamed, selection should follow the new refId.
 */
export function getNextSelectedQueryRefId(
  currentSelectedRefId: string | null,
  originalRefId: string,
  updatedRefId: string
) {
  return currentSelectedRefId === originalRefId ? updatedRefId : currentSelectedRefId;
}

/**
 * Bridge component that subscribes to Scene state and provides it via React Context.
 * Wraps children with QueryEditorProvider so both sidebar and editor can access context.
 */
export function QueryEditorContextWrapper({
  dataPane,
  onSwitchToClassic,
  showVersionBanner,
  children,
}: {
  dataPane: PanelDataPaneNext;
  onSwitchToClassic?: () => void;
  showVersionBanner?: boolean;
  children: ReactNode;
}) {
  const { panelRef, datasource, dsSettings, dsError } = dataPane.useState();
  const panel = panelRef.resolve();
  const queryRunner = getQueryRunnerFor(panel);
  const queryRunnerState = queryRunner?.useState();
  const [selectedQueryRefId, setSelectedQueryRefId] = useState<string | null>(null);
  const [selectedTransformationId, setSelectedTransformationId] = useState<string | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [isQueryOptionsOpen, setIsQueryOptionsOpen] = useState(false);
  const [focusedField, setFocusedField] = useState<QueryOptionField | null>(null);
  const [showingDatasourceHelp, setShowingDatasourceHelp] = useState(false);
  const [pendingSavedQueryState, setPendingSavedQueryState] = useState<PendingSavedQuery | null>(null);
  const [transformTogglesState, setTransformTogglesState] = useState({
    showHelp: false,
    showDebug: false,
  });
  const { isDrawerOpen } = useQueryLibraryContext();
  const pendingSavedQuery = isDrawerOpen ? pendingSavedQueryState : null;

  const dataTransformer = panel.state.$data instanceof SceneDataTransformer ? panel.state.$data : null;
  const transformations = useTransformations(dataTransformer);
  const alertingState = useAlertRulesForPanel(dataPane, panel);

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

  // Transformation UI toggles
  const toggleHelp = useCallback(() => {
    setTransformTogglesState((prev) => ({ ...prev, showHelp: !prev.showHelp }));
  }, []);

  const toggleDebug = useCallback(() => {
    setTransformTogglesState((prev) => ({ ...prev, showDebug: !prev.showDebug }));
  }, []);

  const onCardSelectionChange = useCallback((queryRefId: string | null, transformationId: string | null) => {
    setSelectedQueryRefId(queryRefId);
    setSelectedTransformationId(transformationId);
    setShowingDatasourceHelp(false);
  }, []);

  const { pendingExpression, setPendingExpression, finalizePendingExpression, clearPendingExpression } =
    usePendingExpression({
      addQuery: dataPane.addQuery,
      onCardSelectionChange,
    });

  const findTransformationIndex = useCallback(
    (transformId: string) => {
      return transformations.findIndex((t) => t.transformId === transformId);
    },
    [transformations]
  );

  const addTransformationAction = useCallback(
    (transformationId: string, afterTransformId?: string): string | undefined => {
      const index = afterTransformId ? findTransformationIndex(afterTransformId) : -1;
      const insertAt = dataPane.addTransformation(transformationId, index !== -1 ? index : undefined);
      if (insertAt !== undefined) {
        return getTransformId(transformationId, insertAt);
      }
      return undefined;
    },
    [dataPane, findTransformationIndex]
  );

  const { pendingTransformation, setPendingTransformation, finalizePendingTransformation, clearPendingTransformation } =
    usePendingTransformation({
      addTransformation: addTransformationAction,
      onCardSelectionChange,
    });

  const { selectedQuery, selectedTransformation, selectedAlert } = useSelectedCard(
    selectedQueryRefId,
    selectedTransformationId,
    selectedAlertId,
    queryRunnerState?.queries ?? [],
    transformations,
    alertingState.alertRules,
    Boolean(pendingExpression) || Boolean(pendingTransformation)
  );

  const { selectedQueryDsData, selectedQueryDsLoading } = useSelectedQueryDatasource(selectedQuery, dsSettings);

  const uiState = useMemo(
    () => ({
      selectedQuery,
      selectedTransformation,
      selectedAlert,
      setSelectedQuery: (query: DataQuery | ExpressionQuery | null) => {
        setSelectedQueryRefId(query?.refId ?? null);
        // Clear transformation and alert selection when selecting a query
        setSelectedTransformationId(null);
        setSelectedAlertId(null);
        // Reset datasource help when switching queries
        setShowingDatasourceHelp(false);
        // Reset transformation-specific UI when switching to a query
        setTransformTogglesState({ showHelp: false, showDebug: false });
        // Abandon pending flows when selecting a card
        clearPendingExpression();
        clearPendingTransformation();
        // Clear pending saved query when selecting a query
        setPendingSavedQueryState(null);
      },
      setSelectedTransformation: (transformation: Transformation | null) => {
        setSelectedTransformationId(transformation?.transformId ?? null);
        // Clear query and alert selection when selecting a transformation
        setSelectedQueryRefId(null);
        setSelectedAlertId(null);
        // Reset transformation-specific UI when switching transformations
        setTransformTogglesState({ showHelp: false, showDebug: false });
        // Abandon pending flows when selecting a card
        clearPendingExpression();
        clearPendingTransformation();
        // Clear pending saved query when selecting a transformation
        setPendingSavedQueryState(null);
      },
      setSelectedAlert: (alert: AlertRule | null) => {
        setSelectedAlertId(alert?.alertId ?? null);
        // Clear query and transformation selection when selecting an alert
        setSelectedQueryRefId(null);
        setSelectedTransformationId(null);
        // Reset transformation-specific UI when switching alerts
        setTransformTogglesState({ showHelp: false, showDebug: false });
        // Abandon pending flows when selecting a card
        clearPendingExpression();
        clearPendingTransformation();
        // Clear pending saved query when selecting an alert
        setPendingSavedQueryState(null);
      },
      queryOptions: {
        options: queryOptions,
        isQueryOptionsOpen,
        openSidebar,
        closeSidebar,
        focusedField,
      },
      selectedQueryDsData,
      selectedQueryDsLoading,
      showingDatasourceHelp,
      toggleDatasourceHelp: () => setShowingDatasourceHelp((prev) => !prev),
      cardType: getEditorType(
        selectedQuery || selectedTransformation || selectedAlert,
        pendingExpression,
        pendingTransformation
      ),
      transformToggles: {
        ...transformTogglesState,
        toggleHelp,
        toggleDebug,
      },
      pendingExpression,
      setPendingExpression: (pending: PendingExpression | null) => {
        if (pending) {
          clearPendingTransformation();
          setPendingSavedQueryState(null);
        }
        setPendingExpression(pending);
      },
      finalizePendingExpression,
      pendingSavedQuery,
      setPendingSavedQuery: (pending: PendingSavedQuery | null) => {
        if (pending) {
          clearPendingExpression();
          clearPendingTransformation();
        }
        setPendingSavedQueryState(pending);
      },
      pendingTransformation,
      setPendingTransformation: (pending: PendingTransformation | null) => {
        if (pending) {
          clearPendingExpression();
          setPendingSavedQueryState(null);
        }
        setPendingTransformation(pending);
      },
      finalizePendingTransformation,
      showVersionBanner: Boolean(showVersionBanner),
    }),
    [
      selectedQuery,
      selectedTransformation,
      selectedAlert,
      queryOptions,
      isQueryOptionsOpen,
      openSidebar,
      closeSidebar,
      focusedField,
      selectedQueryDsData,
      selectedQueryDsLoading,
      showingDatasourceHelp,
      transformTogglesState,
      toggleHelp,
      toggleDebug,
      pendingExpression,
      setPendingExpression,
      finalizePendingExpression,
      clearPendingExpression,
      pendingSavedQuery,
      pendingTransformation,
      setPendingTransformation,
      finalizePendingTransformation,
      clearPendingTransformation,
      showVersionBanner,
    ]
  );

  const actions = useMemo(
    () => ({
      onSwitchToClassic,
      updateQueries: dataPane.updateQueries,
      updateSelectedQuery: (updatedQuery: DataQuery, originalRefId: string) => {
        dataPane.updateSelectedQuery(updatedQuery, originalRefId);
        setSelectedQueryRefId((currentSelectedRefId) =>
          getNextSelectedQueryRefId(currentSelectedRefId, originalRefId, updatedQuery.refId)
        );
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
      addTransformation: addTransformationAction,
      deleteTransformation: (transformId: string) => {
        const index = findTransformationIndex(transformId);
        if (index !== -1) {
          dataPane.deleteTransformation(index);
        }
      },
      toggleTransformationDisabled: (transformId: string) => {
        const index = findTransformationIndex(transformId);
        if (index !== -1) {
          dataPane.toggleTransformationDisabled(index);
        }
      },
      updateTransformation: dataPane.updateTransformation,
      reorderTransformations: dataPane.reorderTransformations,
    }),
    [onSwitchToClassic, dataPane, findTransformationIndex, addTransformationAction]
  );

  return (
    <QueryEditorProvider
      dsState={dsState}
      qrState={qrState}
      panelState={panelState}
      alertingState={alertingState}
      uiState={uiState}
      actions={actions}
    >
      {children}
    </QueryEditorProvider>
  );
}
