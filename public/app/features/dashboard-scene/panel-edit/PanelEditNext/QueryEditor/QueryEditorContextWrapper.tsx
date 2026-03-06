import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';

import { DataSourceInstanceSettings, getDataSourceRef, LoadingState } from '@grafana/data';
import { SceneDataTransformer } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { ExpressionQuery } from 'app/features/expressions/types';
import { QueryGroupOptions } from 'app/types/query';

import { getQueryRunnerFor } from '../../../utils/utils';
import { PanelDataPaneNext } from '../PanelDataPaneNext';

import {
  PendingExpression,
  PendingSavedQuery,
  PendingTransformation,
  QueryEditorProvider,
} from './QueryEditorContext';
import { useAlertRulesForPanel } from './hooks/useAlertRulesForPanel';
import { useMultiSelection } from './hooks/useMultiSelection';
import { usePendingExpression } from './hooks/usePendingExpression';
import { usePendingTransformation } from './hooks/usePendingTransformation';
import { useQueryEditorUIToggles } from './hooks/useQueryEditorUIToggles';
import { useQueryOptions } from './hooks/useQueryOptions';
import { useSelectedCard } from './hooks/useSelectedCard';
import { useSelectedQueryDatasource } from './hooks/useSelectedQueryDatasource';
import { useTransformations } from './hooks/useTransformations';
import { AlertRule, Transformation } from './types';
import { getEditorType, getTransformId } from './utils';

/**
 * Keeps query selection stable across refId renames.
 * When the currently selected query is renamed, selection should follow the new refId.
 */
export function getNextSelectedQueryRefIds(
  currentSelectedRefIds: string[],
  originalRefId: string,
  updatedRefId: string
) {
  return currentSelectedRefIds.map((id) => (id === originalRefId ? updatedRefId : id));
}

/**
 * @deprecated Use getNextSelectedQueryRefIds instead.
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
  const [pendingSavedQueryState, setPendingSavedQueryState] = useState<PendingSavedQuery | null>(null);
  const { isDrawerOpen } = useQueryLibraryContext();
  const pendingSavedQuery = isDrawerOpen ? pendingSavedQueryState : null;

  const dataTransformer = panel.state.$data instanceof SceneDataTransformer ? panel.state.$data : null;
  const transformations = useTransformations(dataTransformer);
  const alertingState = useAlertRulesForPanel(dataPane, panel);

  // ── UI toggles (no Scene deps) ────────────────────────────────────────────
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

  // ── Multi-selection (breaks circular dep via ref) ─────────────────────────
  //
  // Circular dependency chain:
  //   useMultiSelection → onClearSideEffects → clearSideEffects → clearPendingExpression
  //   → usePendingExpression → onCardSelectionChange → useMultiSelection
  //
  // A stable ref wrapping clearSideEffects breaks the cycle: useMultiSelection receives
  // a stable callback that always calls the latest clearSideEffects at call time.
  const clearSideEffectsRef = useRef<() => void>(() => {});

  const {
    selectedQueryRefIds,
    selectedTransformationIds,
    selectedAlertId,
    onCardSelectionChange,
    selectAlert,
    trackQueryRename,
    toggleQuerySelection,
    toggleTransformationSelection,
    clearSelection,
  } = useMultiSelection({
    queries: queryRunnerState?.queries ?? [],
    transformations,
    // Stable callback — always delegates to the latest clearSideEffects via ref.
    onClearSideEffects: useCallback(() => clearSideEffectsRef.current(), []),
  });

  // ── Pending items ─────────────────────────────────────────────────────────

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

  // ── Shared cleanup helper ─────────────────────────────────────────────────

  const clearSideEffects = useCallback(() => {
    resetUIToggles();
    clearPendingExpression();
    clearPendingTransformation();
    setPendingSavedQueryState(null);
  }, [resetUIToggles, clearPendingExpression, clearPendingTransformation]);

  // Update the ref every render so the stable callback inside useMultiSelection
  // always delegates to the latest clearSideEffects.
  clearSideEffectsRef.current = clearSideEffects;

  // ── Derived state ─────────────────────────────────────────────────────────

  const dsState = useMemo(
    () => ({
      datasource,
      dsSettings,
      dsError,
    }),
    [datasource, dsSettings, dsError]
  );

  const primaryQueryRefId = selectedQueryRefIds[selectedQueryRefIds.length - 1] ?? null;

  const queryError = useMemo(() => {
    return queryRunnerState?.data?.errors?.find(({ refId }) => refId === primaryQueryRefId);
  }, [queryRunnerState?.data?.errors, primaryQueryRefId]);

  const qrState = useMemo(
    () => ({
      queries: queryRunnerState?.queries ?? [],
      data: queryRunnerState?.data,
      isLoading: queryRunnerState?.data?.state === LoadingState.Loading || queryRunnerState?.data?.state === undefined,
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

  const { selectedQuery, selectedTransformation, selectedAlert } = useSelectedCard(
    selectedQueryRefIds,
    selectedTransformationIds,
    selectedAlertId,
    queryRunnerState?.queries ?? [],
    transformations,
    alertingState.alertRules,
    Boolean(pendingExpression) || Boolean(pendingTransformation)
  );

  const { selectedQueryDsData, selectedQueryDsLoading } = useSelectedQueryDatasource(selectedQuery, dsSettings);

  // ── uiState ───────────────────────────────────────────────────────────────

  const uiState = useMemo(
    () => ({
      selectedQuery,
      selectedTransformation,
      selectedAlert,
      selectedQueryRefIds,
      selectedTransformationIds,
      toggleQuerySelection,
      toggleTransformationSelection,
      clearSelection,
      setSelectedQuery: (query: DataQuery | ExpressionQuery | null) => {
        onCardSelectionChange(query ? query.refId : null, null);
        clearSideEffects();
      },
      setSelectedTransformation: (transformation: Transformation | null) => {
        onCardSelectionChange(null, transformation ? transformation.transformId : null);
        clearSideEffects();
      },
      setSelectedAlert: (alert: AlertRule | null) => {
        selectAlert(alert?.alertId ?? null);
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
      toggleQuerySelection,
      toggleTransformationSelection,
      clearSelection,
      onCardSelectionChange,
      selectAlert,
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

  // ── actions ───────────────────────────────────────────────────────────────

  const actions = useMemo(
    () => ({
      onSwitchToClassic,
      updateQueries: dataPane.updateQueries,
      updateSelectedQuery: (updatedQuery: DataQuery, originalRefId: string) => {
        dataPane.updateSelectedQuery(updatedQuery, originalRefId);
        // Keep selection stable when a query is renamed so the editor stays open.
        trackQueryRename(originalRefId, updatedQuery.refId);
      },
      addQuery: dataPane.addQuery,
      deleteQuery: (refId: string) => {
        dataPane.deleteQuery(refId);
      },
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
      // Bulk actions
      bulkDeleteQueries: (refIds: string[]) => {
        dataPane.bulkDeleteQueries(refIds);
        clearSelection();
      },
      bulkToggleQueriesHide: (refIds: string[], hide: boolean) => {
        dataPane.bulkToggleQueriesHide(refIds, hide);
      },
      bulkDeleteTransformations: (transformIds: string[]) => {
        const indices = transformIds.map((id) => findTransformationIndex(id)).filter((i) => i !== -1);
        dataPane.bulkDeleteTransformations(indices);
        clearSelection();
      },
      bulkToggleTransformationsDisabled: (transformIds: string[], disabled: boolean) => {
        const indices = transformIds.map((id) => findTransformationIndex(id)).filter((i) => i !== -1);
        dataPane.bulkToggleTransformationsDisabled(indices, disabled);
      },
      bulkChangeDataSource: (refIds: string[], settings: DataSourceInstanceSettings) => {
        dataPane.bulkChangeDataSource(refIds, getDataSourceRef(settings));
      },
    }),
    [onSwitchToClassic, dataPane, findTransformationIndex, addTransformationAction, clearSelection, trackQueryRename]
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
