import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { type DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { SceneDataTransformer } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { type ExpressionQuery } from 'app/features/expressions/types';

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
import { useQueryEditorUIToggles } from './hooks/useQueryEditorUIToggles';
import { useQueryOptions } from './hooks/useQueryOptions';
import { useSelectedCard } from './hooks/useSelectedCard';
import { useSelectedQueryDatasource } from './hooks/useSelectedQueryDatasource';
import { useTransformations } from './hooks/useTransformations';
import { type AlertRule, type Transformation } from './types';
import { getEditorType, getTransformId } from './utils';

/**
 * Keeps query selection stable across refId renames.
 * When the currently selected query is renamed, selection should follow the new refId.
 */
export function getNextSelectedQueryRefIds(
  currentSelectedRefIds: readonly string[],
  originalRefId: string,
  updatedRefId: string
) {
  return currentSelectedRefIds.map((id) => (id === originalRefId ? updatedRefId : id));
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
  const [pendingSavedQueryState, setPendingSavedQueryState] = useState<PendingSavedQuery | null>(null);
  const { isDrawerOpen } = useQueryLibraryContext();
  const pendingSavedQuery = isDrawerOpen ? pendingSavedQueryState : null;

  const dataTransformer = panel.state.$data instanceof SceneDataTransformer ? panel.state.$data : null;
  const transformations = useTransformations(dataTransformer);
  const alertingState = useAlertRulesForPanel(dataPane, panel);

  // UI toggles
  const {
    isQueryOptionsOpen,
    focusedField,
    showingDatasourceHelp,
    transformTogglesState,
    openSidebar,
    closeSidebar,
    resetUIToggles,
    toggleDatasourceHelp,
    toggleHelp,
    toggleDebug,
  } = useQueryEditorUIToggles();

  const [selectedQueryRefIds, setSelectedQueryRefIds] = useState<string[]>([]);
  const [selectedTransformationIds, setSelectedTransformationIds] = useState<string[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  const onCardSelectionChange = useCallback((queryRefId: string | null, transformationId: string | null) => {
    setSelectedQueryRefIds(queryRefId ? [queryRefId] : []);
    setSelectedTransformationIds(transformationId ? [transformationId] : []);
    setSelectedAlertId(null);
  }, []);

  // Wraps onCardSelectionChange with a UI reset for use in finalizePendingExpression /
  // finalizePendingTransformation — those paths bypass clearSideEffects entirely, so
  // resetUIToggles would otherwise never be called and the datasource help panel would
  // remain visible after the picker resolves.
  const onFinalizeCardSelection = useCallback(
    (queryRefId: string | null, transformationId: string | null) => {
      onCardSelectionChange(queryRefId, transformationId);
      resetUIToggles();
    },
    [onCardSelectionChange, resetUIToggles]
  );

  const { pendingExpression, setPendingExpression, finalizePendingExpression, clearPendingExpression } =
    usePendingExpression({
      addQuery: dataPane.addQuery,
      onCardSelectionChange: onFinalizeCardSelection,
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
      onCardSelectionChange: onFinalizeCardSelection,
    });

  const clearSideEffects = useCallback(() => {
    resetUIToggles();
    clearPendingExpression();
    clearPendingTransformation();
    setPendingSavedQueryState(null);
  }, [resetUIToggles, clearPendingExpression, clearPendingTransformation]);

  const dsState = useMemo(
    () => ({
      datasource,
      dsSettings,
      dsError,
    }),
    [datasource, dsSettings, dsError]
  );

  const queryOptions = useQueryOptions({ panel, queryRunner, dsSettings });

  const { selectedQuery, selectedTransformation, selectedAlert, primaryQueryRefId } = useSelectedCard(
    selectedQueryRefIds,
    selectedTransformationIds,
    selectedAlertId,
    queryRunnerState?.queries ?? [],
    transformations,
    alertingState.alertRules,
    Boolean(pendingExpression) || Boolean(pendingTransformation)
  );

  const { selectedQueryDsData, selectedQueryDsLoading } = useSelectedQueryDatasource(selectedQuery, dsSettings);

  const queryError = useMemo(() => {
    return queryRunnerState?.data?.errors?.find(({ refId }) => refId === primaryQueryRefId);
  }, [queryRunnerState?.data?.errors, primaryQueryRefId]);

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

  const uiState = useMemo(
    () => ({
      selectedQuery,
      selectedTransformation,
      selectedAlert,
      selectedQueryRefIds,
      selectedTransformationIds,
      setSelectedQuery: (query: DataQuery | ExpressionQuery | null) => {
        onCardSelectionChange(query ? query.refId : null, null);
        clearSideEffects();
      },
      setSelectedTransformation: (transformation: Transformation | null) => {
        onCardSelectionChange(null, transformation ? transformation.transformId : null);
        clearSideEffects();
      },
      setSelectedAlert: (alert: AlertRule | null) => {
        setSelectedAlertId(alert?.alertId ?? null);
        setSelectedQueryRefIds([]);
        setSelectedTransformationIds([]);
        clearSideEffects();
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
      toggleDatasourceHelp,
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
      selectedQueryRefIds,
      selectedTransformationIds,
      onCardSelectionChange,
      clearSideEffects,
      queryOptions,
      isQueryOptionsOpen,
      openSidebar,
      closeSidebar,
      focusedField,
      selectedQueryDsData,
      selectedQueryDsLoading,
      showingDatasourceHelp,
      toggleDatasourceHelp,
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
        // Keep selection stable when a query is renamed so the editor stays open.
        setSelectedQueryRefIds((current) => getNextSelectedQueryRefIds(current, originalRefId, updatedQuery.refId));
      },
      addQuery: dataPane.addQuery,
      deleteQuery: (refId: string) => {
        dataPane.deleteQuery(refId);
        setSelectedQueryRefIds((current) => current.filter((id) => id !== refId));
      },
      duplicateQuery: dataPane.duplicateQuery,
      toggleQueryHide: dataPane.toggleQueryHide,
      runQueries: dataPane.runQueries,
      changeDataSource: (settings: DataSourceInstanceSettings, queryRefId: string) => {
        dataPane.changeDataSource(getDataSourceRef(settings), queryRefId);
      },
      onQueryOptionsChange: dataPane.onQueryOptionsChange,
      addTransformation: addTransformationAction,
      deleteTransformation: (transformId: string) => {
        const index = findTransformationIndex(transformId);
        if (index !== -1) {
          dataPane.deleteTransformation(index);
        }
        setSelectedTransformationIds((current) => current.filter((id) => id !== transformId));
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
