import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';

import { type DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { SceneDataTransformer } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { useTheme2 } from '@grafana/ui';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { type ExpressionQuery } from 'app/features/expressions/types';

import { type PanelDataPaneNext } from '../PanelDataPaneNext';
import { getQueryEditorTypeConfig } from '../constants';

import { type PendingSavedQuery, QueryEditorProvider, type SelectionModifiers } from './QueryEditorContext';
import { useStackedModeOrchestration } from './StackedEditor/useStackedModeOrchestration';
import { useAlertRulesForPanel } from './hooks/useAlertRulesForPanel';
import { usePendingExpression } from './hooks/usePendingExpression';
import { usePendingPickerSetters } from './hooks/usePendingPickerSetters';
import { usePendingTransformation } from './hooks/usePendingTransformation';
import { useQueryEditorUIToggles } from './hooks/useQueryEditorUIToggles';
import { useQueryOptions } from './hooks/useQueryOptions';
import { useSelectedCard } from './hooks/useSelectedCard';
import { useSelectedQueryDatasource } from './hooks/useSelectedQueryDatasource';
import { useSelectionState } from './hooks/useSelectionState';
import { useTransformations } from './hooks/useTransformations';
import { type AlertRule, type Transformation } from './types';
import { getEditorType, getTransformId } from './utils';

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
  const theme = useTheme2();
  const { panelRef, datasource, dsSettings, dsError } = dataPane.useState();
  const panel = panelRef.resolve();
  const queryRunner = getQueryRunnerFor(panel);
  const queryRunnerState = queryRunner?.useState();
  const [pendingSavedQueryState, setPendingSavedQueryRaw] = useState<PendingSavedQuery | null>(null);
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

  const clearSideEffectsRef = useRef<() => void>(() => {});
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [confirmingDeleteActionKey, setConfirmingDeleteActionKey] = useState<string | null>(null);

  const {
    activeQueryRefId,
    activeTransformationId,
    selectedQueryRefIds,
    selectedTransformationIds,
    onCardSelectionChange: onCardSelectionChangeRaw,
    trackQueryRename,
    activateQuery: activateQueryRaw,
    activateTransformation: activateTransformationRaw,
    toggleQuerySelection: toggleQuerySelectionRaw,
    toggleTransformationSelection: toggleTransformationSelectionRaw,
    clearSelection: clearSelectionRaw,
    clearMultiSelection: clearMultiSelectionRaw,
    selectActiveInMultiSelection: selectActiveInMultiSelectionRaw,
    removeQueryFromSelection,
    removeTransformationFromSelection,
  } = useSelectionState({
    queries: queryRunnerState?.queries ?? [],
    transformations,
    // Stable callback — always delegates to the latest clearSideEffects via ref.
    onClearSideEffects: useCallback(() => clearSideEffectsRef.current(), []),
  });

  // Wrap each selection mutator to clear alert selection (cross-type exclusivity) and dismiss any
  // open inline delete confirmation because both are selection-scoped UI state.
  const onCardSelectionChange = useCallback(
    (queryRefId: string | null, transformationId: string | null, options?: { seedBulk?: boolean }) => {
      setSelectedAlertId(null);
      setConfirmingDeleteActionKey(null);
      onCardSelectionChangeRaw(queryRefId, transformationId, options);
    },
    [onCardSelectionChangeRaw]
  );

  const stackedMode = useStackedModeOrchestration({
    onCardSelectionChange,
    selectedQueryRefIds,
    selectedTransformationIds,
    // Entering stacked mode clears cross-mode UI state (alert selection, multi-select).
    onEnter: () => {
      setSelectedAlertId(null);
      setMultiSelectMode(false);
    },
  });
  // Destructured for tight dep arrays in the selection handlers below — these property reads
  // are referentially stable when their underlying state doesn't change.
  const { enabled: isStackedMode, exit: exitStackedMode } = stackedMode;

  const toggleQuerySelection = useCallback(
    (query: DataQuery | ExpressionQuery, modifiers?: SelectionModifiers) => {
      setSelectedAlertId(null);
      if (isStackedMode) {
        // Stacked mode is single-select; the renderer scrolls to whatever becomes selected.
        onCardSelectionChange(query.refId, null);
        return;
      }
      setConfirmingDeleteActionKey(null);
      if (modifiers?.multi || modifiers?.range) {
        if (!multiSelectMode) {
          return;
        }
        toggleQuerySelectionRaw(query, modifiers);
        return;
      }
      activateQueryRaw(query);
    },
    [isStackedMode, onCardSelectionChange, multiSelectMode, activateQueryRaw, toggleQuerySelectionRaw]
  );

  const toggleTransformationSelection = useCallback(
    (transformation: Transformation, modifiers?: SelectionModifiers) => {
      setSelectedAlertId(null);
      if (isStackedMode) {
        onCardSelectionChange(null, transformation.transformId);
        return;
      }
      setConfirmingDeleteActionKey(null);
      if (modifiers?.multi || modifiers?.range) {
        if (!multiSelectMode) {
          return;
        }
        toggleTransformationSelectionRaw(transformation, modifiers);
        return;
      }
      activateTransformationRaw(transformation);
    },
    [isStackedMode, onCardSelectionChange, multiSelectMode, activateTransformationRaw, toggleTransformationSelectionRaw]
  );

  const resetSelectionState = useCallback(
    (alertId: string | null) => {
      exitStackedMode();
      setSelectedAlertId(alertId);
      setMultiSelectMode(false);
      setConfirmingDeleteActionKey(null);
      clearSelectionRaw();
    },
    [clearSelectionRaw, exitStackedMode]
  );

  const clearSelection = useCallback(() => resetSelectionState(null), [resetSelectionState]);
  const selectAlert = useCallback((alertId: string | null) => resetSelectionState(alertId), [resetSelectionState]);

  const setMultiSelectModeState = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        // Nothing to select means multi-select would have an empty set, and a card added later
        // would arrive unchecked — so refuse to enter the mode until there's a card to seed.
        const hasCards = (queryRunnerState?.queries?.length ?? 0) + transformations.length > 0;
        if (!hasCards) {
          return;
        }
        // Multi-select and stacked mode are mutually exclusive, so leaving stacked mode here
        // keeps the two views from being active at once before seeding the bulk selection.
        exitStackedMode();
        selectActiveInMultiSelectionRaw();
      } else {
        clearMultiSelectionRaw();
      }
      setMultiSelectMode(enabled);
    },
    [
      queryRunnerState?.queries,
      transformations,
      exitStackedMode,
      clearMultiSelectionRaw,
      selectActiveInMultiSelectionRaw,
    ]
  );

  // Wraps onCardSelectionChange with a UI reset for use in finalizePendingExpression /
  // finalizePendingTransformation — those paths bypass clearSideEffects entirely, so
  // resetUIToggles would otherwise never be called and the datasource help panel would
  // remain visible after the picker resolves.
  const onFinalizeCardSelection = useCallback(
    (queryRefId: string | null, transformationId: string | null) => {
      onCardSelectionChange(queryRefId, transformationId, { seedBulk: multiSelectMode });
      resetUIToggles();
    },
    [onCardSelectionChange, multiSelectMode, resetUIToggles]
  );

  const {
    pendingExpression,
    setPendingExpression: setPendingExpressionRaw,
    finalizePendingExpression,
    clearPendingExpression,
  } = usePendingExpression({
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

  const {
    pendingTransformation,
    setPendingTransformation: setPendingTransformationRaw,
    finalizePendingTransformation,
    clearPendingTransformation,
  } = usePendingTransformation({
    addTransformation: addTransformationAction,
    onCardSelectionChange: onFinalizeCardSelection,
  });

  const { setPendingExpression, setPendingTransformation, setPendingSavedQuery } = usePendingPickerSetters({
    setPendingExpression: setPendingExpressionRaw,
    setPendingTransformation: setPendingTransformationRaw,
    setPendingSavedQuery: setPendingSavedQueryRaw,
  });

  const clearSideEffects = useCallback(() => {
    resetUIToggles();
    clearPendingExpression();
    clearPendingTransformation();
    setPendingSavedQueryRaw(null);
  }, [resetUIToggles, clearPendingExpression, clearPendingTransformation]);

  // Update the ref every render so the stable callback inside useSelectionState
  // always delegates to the latest clearSideEffects.
  clearSideEffectsRef.current = clearSideEffects;

  // Hoisted out of `uiState` so they stay referentially stable across selection changes —
  // consumers that put these in a useEffect/useMemo dep array only re-fire when multi-select
  // mode toggles, not on every active-card change.
  const setSelectedQuery = useCallback(
    (query: DataQuery | ExpressionQuery | null) => {
      setSelectedAlertId(null);
      if (multiSelectMode && query) {
        // In multi-select mode we only move the active card; activateQueryRaw fires
        // onClearSideEffects via the hook's ref, so no second clearSideEffects call is needed.
        activateQueryRaw(query);
        return;
      }
      onCardSelectionChange(query ? query.refId : null, null);
      clearSideEffects();
    },
    [multiSelectMode, activateQueryRaw, onCardSelectionChange, clearSideEffects]
  );

  const setSelectedTransformation = useCallback(
    (transformation: Transformation | null) => {
      setSelectedAlertId(null);
      if (multiSelectMode && transformation) {
        activateTransformationRaw(transformation);
        return;
      }
      onCardSelectionChange(null, transformation ? transformation.transformId : null);
      clearSideEffects();
    },
    [multiSelectMode, activateTransformationRaw, onCardSelectionChange, clearSideEffects]
  );

  const setSelectedAlert = useCallback(
    (alert: AlertRule | null) => {
      selectAlert(alert?.alertId ?? null);
    },
    [selectAlert]
  );

  const dsState = useMemo(
    () => ({
      datasource,
      dsSettings,
      dsError,
    }),
    [datasource, dsSettings, dsError]
  );

  const queryError = useMemo(() => {
    return queryRunnerState?.data?.errors?.find(({ refId }) => refId === activeQueryRefId);
  }, [queryRunnerState?.data?.errors, activeQueryRefId]);

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

  const typeConfig = useMemo(() => getQueryEditorTypeConfig(theme), [theme]);

  const queryOptions = useQueryOptions({ panel, queryRunner, dsSettings });

  const { selectedQuery, selectedTransformation, selectedAlert } = useSelectedCard(
    activeQueryRefId,
    activeTransformationId,
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
      selectedQueryRefIds,
      selectedTransformationIds,
      multiSelectMode,
      toggleQuerySelection,
      toggleTransformationSelection,
      clearSelection,
      setSelectedQuery,
      setSelectedTransformation,
      setSelectedAlert,
      setMultiSelectMode: setMultiSelectModeState,
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
        selectedQuery ?? selectedTransformation ?? selectedAlert,
        pendingExpression,
        pendingTransformation
      ),
      transformToggles: {
        ...transformTogglesState,
        toggleHelp,
        toggleDebug,
      },
      pendingExpression,
      setPendingExpression,
      finalizePendingExpression,
      pendingSavedQuery,
      setPendingSavedQuery,
      pendingTransformation,
      setPendingTransformation,
      finalizePendingTransformation,
      stackedMode,
      showVersionBanner: Boolean(showVersionBanner),
      confirmingDeleteActionKey,
      setConfirmingDeleteActionKey,
    }),
    [
      selectedQuery,
      selectedTransformation,
      selectedAlert,
      selectedQueryRefIds,
      selectedTransformationIds,
      multiSelectMode,
      toggleQuerySelection,
      toggleTransformationSelection,
      clearSelection,
      setSelectedQuery,
      setSelectedTransformation,
      setSelectedAlert,
      setMultiSelectModeState,
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
      stackedMode,
      setPendingExpression,
      finalizePendingExpression,
      pendingSavedQuery,
      setPendingSavedQuery,
      pendingTransformation,
      setPendingTransformation,
      finalizePendingTransformation,
      showVersionBanner,
      confirmingDeleteActionKey,
    ]
  );

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
        removeQueryFromSelection(refId);
        // Deleting a card from its header exits multi-select mode so the checkboxes and bulk-actions
        // footer revert together instead of leaving a desynced multi-select state behind.
        setMultiSelectModeState(false);
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
        removeTransformationFromSelection(transformId);
        // Deleting a card from its header exits multi-select mode so the checkboxes and bulk-actions
        // footer revert together instead of leaving a desynced multi-select state behind.
        setMultiSelectModeState(false);
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
      bulkDeleteQueries: dataPane.bulkDeleteQueries,
      bulkToggleQueriesHide: dataPane.bulkToggleQueriesHide,
      bulkDeleteTransformations: (transformIds: readonly string[]) => {
        const indices = transformIds.map((id) => findTransformationIndex(id)).filter((i) => i !== -1);
        dataPane.bulkDeleteTransformations(indices);
      },
      bulkToggleTransformationsDisabled: (transformIds: readonly string[], disabled: boolean) => {
        const indices = transformIds.map((id) => findTransformationIndex(id)).filter((i) => i !== -1);
        dataPane.bulkToggleTransformationsDisabled(indices, disabled);
      },
      bulkChangeDataSource: (refIds: readonly string[], settings: DataSourceInstanceSettings) =>
        dataPane.bulkChangeDataSource(refIds, getDataSourceRef(settings)),
    }),
    [
      addTransformationAction,
      dataPane,
      findTransformationIndex,
      onSwitchToClassic,
      removeQueryFromSelection,
      removeTransformationFromSelection,
      setMultiSelectModeState,
      trackQueryRename,
    ]
  );

  return (
    <QueryEditorProvider
      dsState={dsState}
      qrState={qrState}
      panelState={panelState}
      alertingState={alertingState}
      uiState={uiState}
      actions={actions}
      typeConfig={typeConfig}
    >
      {children}
    </QueryEditorProvider>
  );
}
