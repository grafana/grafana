import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';

import { type DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { SceneDataTransformer } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { useTheme2 } from '@grafana/ui';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { type ExpressionQuery } from 'app/features/expressions/types';

import { getQueryRunnerFor } from '../../../utils/utils';
import { type PanelDataPaneNext } from '../PanelDataPaneNext';
import { getQueryEditorTypeConfig } from '../constants';

import {
  type PendingExpression,
  type PendingSavedQuery,
  type PendingTransformation,
  QueryEditorProvider,
  type SelectionModifiers,
} from './QueryEditorContext';
import { useAlertRulesForPanel } from './hooks/useAlertRulesForPanel';
import { usePendingExpression } from './hooks/usePendingExpression';
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

  const clearSideEffectsRef = useRef<() => void>(() => {});
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectModeState] = useState(false);

  const {
    highlightedQueryRefId,
    highlightedTransformationId,
    selectedQueryRefIds,
    selectedTransformationIds,
    highlightQuery: highlightQueryRaw,
    highlightTransformation: highlightTransformationRaw,
    onCardSelectionChange: onCardSelectionChangeRaw,
    trackQueryRename,
    toggleQuerySelection: toggleQuerySelectionRaw,
    toggleTransformationSelection: toggleTransformationSelectionRaw,
    clearSelection: clearSelectionRaw,
    seedSelectionWithHighlight,
    removeQueryFromSelection,
    removeTransformationFromSelection,
  } = useSelectionState({
    queries: queryRunnerState?.queries ?? [],
    transformations,
    // Stable callback — always delegates to the latest clearSideEffects via ref.
    onClearSideEffects: useCallback(() => clearSideEffectsRef.current(), []),
  });

  // Wrap each selection mutator to clear alert selection (cross-type exclusivity).
  const onCardSelectionChange = useCallback(
    (queryRefId: string | null, transformationId: string | null) => {
      setHighlightedAlertId(null);
      onCardSelectionChangeRaw(queryRefId, transformationId);
    },
    [onCardSelectionChangeRaw]
  );

  const highlightQuery = useCallback(
    (query: DataQuery | ExpressionQuery) => {
      setHighlightedAlertId(null);
      highlightQueryRaw(query);
    },
    [highlightQueryRaw]
  );

  const highlightTransformation = useCallback(
    (transformation: Transformation) => {
      setHighlightedAlertId(null);
      highlightTransformationRaw(transformation);
    },
    [highlightTransformationRaw]
  );

  const toggleQuerySelection = useCallback(
    (query: DataQuery | ExpressionQuery, modifiers?: SelectionModifiers) => {
      setHighlightedAlertId(null);
      toggleQuerySelectionRaw(query, modifiers);
    },
    [toggleQuerySelectionRaw]
  );

  const toggleTransformationSelection = useCallback(
    (transformation: Transformation, modifiers?: SelectionModifiers) => {
      setHighlightedAlertId(null);
      toggleTransformationSelectionRaw(transformation, modifiers);
    },
    [toggleTransformationSelectionRaw]
  );

  const clearSelection = useCallback(() => {
    setHighlightedAlertId(null);
    clearSelectionRaw();
  }, [clearSelectionRaw]);

  // Entering multi-select mode seeds the selection set with the currently
  // highlighted card so the bulk-actions bar opens with one item selected
  // (instead of a degenerate "mode on, nothing actionable" state). Exiting
  // multi-select empties the selection set.
  const setMultiSelectMode = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        seedSelectionWithHighlight();
      } else {
        clearSelectionRaw();
      }
      setMultiSelectModeState(enabled);
    },
    [seedSelectionWithHighlight, clearSelectionRaw]
  );

  const selectAlert = useCallback(
    (alertId: string | null) => {
      setHighlightedAlertId(alertId);
      // Selecting an alert clears both the highlight and the selection set
      // for queries/transformations so the editor pane shows the alert only.
      onCardSelectionChangeRaw(null, null);
    },
    [onCardSelectionChangeRaw]
  );

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

  // Update the ref every render so the stable callback inside useSelectionState
  // always delegates to the latest clearSideEffects.
  clearSideEffectsRef.current = clearSideEffects;

  const dsState = useMemo(
    () => ({
      datasource,
      dsSettings,
      dsError,
    }),
    [datasource, dsSettings, dsError]
  );

  const queryError = useMemo(() => {
    return queryRunnerState?.data?.errors?.find(({ refId }) => refId === highlightedQueryRefId);
  }, [queryRunnerState?.data?.errors, highlightedQueryRefId]);

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

  const { highlightedQuery, highlightedTransformation, highlightedAlert } = useSelectedCard(
    highlightedQueryRefId,
    highlightedTransformationId,
    highlightedAlertId,
    queryRunnerState?.queries ?? [],
    transformations,
    alertingState.alertRules,
    Boolean(pendingExpression) || Boolean(pendingTransformation)
  );

  const { selectedQueryDsData, selectedQueryDsLoading } = useSelectedQueryDatasource(highlightedQuery, dsSettings);

  const uiState = useMemo(
    () => ({
      highlightedQuery,
      highlightedTransformation,
      highlightedAlert,
      selectedQueryRefIds,
      selectedTransformationIds,
      multiSelectMode,
      highlightQuery,
      highlightTransformation,
      toggleQuerySelection,
      toggleTransformationSelection,
      clearSelection,
      setHighlightedQuery: (query: DataQuery | ExpressionQuery | null) => {
        onCardSelectionChange(query ? query.refId : null, null);
        clearSideEffects();
      },
      setHighlightedTransformation: (transformation: Transformation | null) => {
        onCardSelectionChange(null, transformation ? transformation.transformId : null);
        clearSideEffects();
      },
      setHighlightedAlert: (alert: AlertRule | null) => {
        selectAlert(alert?.alertId ?? null);
      },
      setMultiSelectMode,
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
        highlightedQuery || highlightedTransformation || highlightedAlert,
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
      highlightedQuery,
      highlightedTransformation,
      highlightedAlert,
      selectedQueryRefIds,
      selectedTransformationIds,
      multiSelectMode,
      highlightQuery,
      highlightTransformation,
      toggleQuerySelection,
      toggleTransformationSelection,
      clearSelection,
      setMultiSelectMode,
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
