import { ReactNode, useCallback, useMemo, useState } from 'react';

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
  SelectionModifiers,
} from './QueryEditorContext';
import { useAlertRulesForPanel } from './hooks/useAlertRulesForPanel';
import { usePendingExpression } from './hooks/usePendingExpression';
import { usePendingTransformation } from './hooks/usePendingTransformation';
import { useQueryOptions } from './hooks/useQueryOptions';
import { useSelectedCard } from './hooks/useSelectedCard';
import { useSelectedQueryDatasource } from './hooks/useSelectedQueryDatasource';
import { useTransformations } from './hooks/useTransformations';
import { AlertRule, QueryOptionField, Transformation } from './types';
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
  // Ordered arrays — last element is the "primary" selection (shown in editor pane).
  const [selectedQueryRefIds, setSelectedQueryRefIds] = useState<string[]>([]);
  const [selectedTransformationIds, setSelectedTransformationIds] = useState<string[]>([]);
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
    setSelectedQueryRefIds(queryRefId ? [queryRefId] : []);
    setSelectedTransformationIds(transformationId ? [transformationId] : []);
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
    selectedQueryRefIds,
    selectedTransformationIds,
    selectedAlertId,
    queryRunnerState?.queries ?? [],
    transformations,
    alertingState.alertRules,
    Boolean(pendingExpression) || Boolean(pendingTransformation)
  );

  const { selectedQueryDsData, selectedQueryDsLoading } = useSelectedQueryDatasource(selectedQuery, dsSettings);

  // ── Shared cleanup helper ─────────────────────────────────────────────────
  const clearSideEffects = useCallback(() => {
    setShowingDatasourceHelp(false);
    setTransformTogglesState({ showHelp: false, showDebug: false });
    clearPendingExpression();
    clearPendingTransformation();
    setPendingSavedQueryState(null);
  }, [clearPendingExpression, clearPendingTransformation]);

  // ── Multi-select handlers ─────────────────────────────────────────────────

  const toggleQuerySelection = useCallback(
    (query: DataQuery | ExpressionQuery, modifiers?: SelectionModifiers) => {
      const allQueries = queryRunnerState?.queries ?? [];

      if (modifiers?.range) {
        // Shift+Click: range-select from the anchor to this query (inclusive).
        // When nothing has been explicitly clicked yet, useSelectedCard defaults to allQueries[0],
        // so treat that as the anchor so Shift+Click works immediately on page load.
        const anchorRefId =
          selectedQueryRefIds.length > 0
            ? selectedQueryRefIds[selectedQueryRefIds.length - 1]
            : (allQueries[0]?.refId ?? null);
        const anchorIdx = allQueries.findIndex((q) => q.refId === anchorRefId);
        const clickedIdx = allQueries.findIndex((q) => q.refId === query.refId);
        if (anchorIdx !== -1 && clickedIdx !== -1) {
          const [start, end] =
            anchorIdx <= clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx];
          const rangeRefIds = allQueries.slice(start, end + 1).map((q) => q.refId);
          // Union of current selection and range; clicked item becomes primary (last).
          const existingWithoutRange = selectedQueryRefIds.filter((id) => !rangeRefIds.includes(id));
          setSelectedQueryRefIds([...existingWithoutRange, ...rangeRefIds]);
          setSelectedTransformationIds([]);
          setSelectedAlertId(null);
          return;
        }
      }

      if (modifiers?.multi) {
        // Ctrl/Cmd+Click: toggle this query in/out of the selection.
        setSelectedQueryRefIds((prev) => {
          const idx = prev.indexOf(query.refId);
          return idx === -1 ? [...prev, query.refId] : prev.filter((id) => id !== query.refId);
        });
        setSelectedTransformationIds([]);
        setSelectedAlertId(null);
      } else {
        // Plain click: replace entire selection with just this card.
        setSelectedQueryRefIds([query.refId]);
        setSelectedTransformationIds([]);
        setSelectedAlertId(null);
        clearSideEffects();
      }
    },
    [clearSideEffects, selectedQueryRefIds, queryRunnerState?.queries]
  );

  const toggleTransformationSelection = useCallback(
    (transformation: Transformation, modifiers?: SelectionModifiers) => {
      if (modifiers?.range && selectedTransformationIds.length > 0) {
        // Shift+Click: range-select from the last selected transformation to this one.
        const anchorId = selectedTransformationIds[selectedTransformationIds.length - 1];
        const anchorIdx = transformations.findIndex((t) => t.transformId === anchorId);
        const clickedIdx = transformations.findIndex((t) => t.transformId === transformation.transformId);
        if (anchorIdx !== -1 && clickedIdx !== -1) {
          const [start, end] =
            anchorIdx <= clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx];
          const rangeIds = transformations.slice(start, end + 1).map((t) => t.transformId);
          const existingWithoutRange = selectedTransformationIds.filter((id) => !rangeIds.includes(id));
          setSelectedTransformationIds([...existingWithoutRange, ...rangeIds]);
          setSelectedQueryRefIds([]);
          setSelectedAlertId(null);
          return;
        }
      }

      if (modifiers?.multi) {
        setSelectedTransformationIds((prev) => {
          const idx = prev.indexOf(transformation.transformId);
          return idx === -1
            ? [...prev, transformation.transformId]
            : prev.filter((id) => id !== transformation.transformId);
        });
        setSelectedQueryRefIds([]);
        setSelectedAlertId(null);
      } else {
        setSelectedTransformationIds([transformation.transformId]);
        setSelectedQueryRefIds([]);
        setSelectedAlertId(null);
        clearSideEffects();
      }
    },
    [clearSideEffects, selectedTransformationIds, transformations]
  );

  const clearSelection = useCallback(() => {
    setSelectedQueryRefIds([]);
    setSelectedTransformationIds([]);
    setSelectedAlertId(null);
    clearPendingExpression();
    clearPendingTransformation();
  }, [clearPendingExpression, clearPendingTransformation]);

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
        setSelectedQueryRefIds(query ? [query.refId] : []);
        setSelectedTransformationIds([]);
        setSelectedAlertId(null);
        clearSideEffects();
      },
      setSelectedTransformation: (transformation: Transformation | null) => {
        setSelectedTransformationIds(transformation ? [transformation.transformId] : []);
        setSelectedQueryRefIds([]);
        setSelectedAlertId(null);
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
      selectedQueryRefIds,
      selectedTransformationIds,
      toggleQuerySelection,
      toggleTransformationSelection,
      clearSelection,
      clearSideEffects,
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

  // ── actions ───────────────────────────────────────────────────────────────

  const actions = useMemo(
    () => ({
      onSwitchToClassic,
      updateQueries: dataPane.updateQueries,
      updateSelectedQuery: (updatedQuery: DataQuery, originalRefId: string) => {
        dataPane.updateSelectedQuery(updatedQuery, originalRefId);
        setSelectedQueryRefIds((current) => getNextSelectedQueryRefIds(current, originalRefId, updatedQuery.refId));
      },
      addQuery: dataPane.addQuery,
      deleteQuery: (refId: string) => {
        dataPane.deleteQuery(refId);
        setSelectedQueryRefIds((prev) => prev.filter((id) => id !== refId));
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
          setSelectedTransformationIds((prev) => prev.filter((id) => id !== transformId));
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
        setSelectedQueryRefIds([]);
      },
      bulkToggleQueriesHide: (refIds: string[], hide: boolean) => {
        dataPane.bulkToggleQueriesHide(refIds, hide);
      },
      bulkDeleteTransformations: (transformIds: string[]) => {
        const indices = transformIds
          .map((id) => findTransformationIndex(id))
          .filter((i) => i !== -1);
        dataPane.bulkDeleteTransformations(indices);
        setSelectedTransformationIds([]);
      },
      bulkToggleTransformationsDisabled: (transformIds: string[], disabled: boolean) => {
        const indices = transformIds
          .map((id) => findTransformationIndex(id))
          .filter((i) => i !== -1);
        dataPane.bulkToggleTransformationsDisabled(indices, disabled);
      },
      bulkChangeDataSource: (refIds: string[], settings: DataSourceInstanceSettings) => {
        dataPane.bulkChangeDataSource(refIds, getDataSourceRef(settings));
      },
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
