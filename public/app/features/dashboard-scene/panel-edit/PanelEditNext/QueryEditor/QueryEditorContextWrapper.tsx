import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';

import { DataSourceInstanceSettings, getDataSourceRef, LoadingState } from '@grafana/data';
import { SceneDataTransformer } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { ExpressionQueryType } from 'app/features/expressions/types';
import { getDefaults } from 'app/features/expressions/utils/expressionTypes';
import { QueryGroupOptions } from 'app/types/query';

import { getQueryRunnerFor } from '../../../utils/utils';
import { PanelDataPaneNext } from '../PanelDataPaneNext';

import {
  ActiveContext,
  CardRef,
  DataSelection,
  INITIAL_ACTIVE_CONTEXT,
  QueryEditorProvider,
} from './QueryEditorContext';
import { useAlertRulesForPanel } from './hooks/useAlertRulesForPanel';
import { useQueryOptions } from './hooks/useQueryOptions';
import { useSelectedCard } from './hooks/useSelectedCard';
import { useSelectedQueryDatasource } from './hooks/useSelectedQueryDatasource';
import { useTransformations } from './hooks/useTransformations';
import { QueryOptionField } from './types';
import { getTransformId } from './utils';

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

  const [activeContext, setActiveContextState] = useState<ActiveContext>(INITIAL_ACTIVE_CONTEXT);
  const [selectedItemsState, setSelectedItemsState] = useState<CardRef[]>([]);
  const [isQueryOptionsOpen, setIsQueryOptionsOpen] = useState(false);
  const [focusedField, setFocusedField] = useState<QueryOptionField | null>(null);
  const [showingDatasourceHelp, setShowingDatasourceHelp] = useState(false);
  const [transformTogglesState, setTransformTogglesState] = useState({ showHelp: false, showDebug: false });

  // Always-fresh ref — lets the finalize callbacks read the current context in
  // event handlers without taking activeContext as a dep (keeps them stable).
  const activeContextRef = useRef(activeContext);
  activeContextRef.current = activeContext;

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

  const selectedQueryRefId =
    activeContext.view === 'data' &&
    (activeContext.selection.kind === 'query' || activeContext.selection.kind === 'expression')
      ? activeContext.selection.refId
      : null;

  const queryError = useMemo(() => {
    return queryRunnerState?.data?.errors?.find(({ refId }) => refId === selectedQueryRefId);
  }, [queryRunnerState?.data?.errors, selectedQueryRefId]);

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

  const toggleHelp = useCallback(() => setTransformTogglesState((prev) => ({ ...prev, showHelp: !prev.showHelp })), []);
  const toggleDebug = useCallback(
    () => setTransformTogglesState((prev) => ({ ...prev, showDebug: !prev.showDebug })),
    []
  );
  const toggleDatasourceHelp = useCallback(() => setShowingDatasourceHelp((prev) => !prev), []);

  /**
   * Maps a DataSelection to a CardRef for the multi-selection set.
   * Returns null for picker states and `none` since they have no focused card.
   */
  const selectionToCardRef = (selection: DataSelection): CardRef | null => {
    if (selection.kind === 'query') {
      return { kind: 'query', refId: selection.refId };
    }
    if (selection.kind === 'expression') {
      return { kind: 'expression', refId: selection.refId };
    }
    if (selection.kind === 'transformation') {
      return { kind: 'transformation', id: selection.id };
    }
    return null;
  };

  /**
   * Primary navigation setter. Atomically resets transform toggles, the
   * datasource help panel, and the multi-selection set so stale UI state
   * never bleeds into the next card.
   */
  const setActiveContext = useCallback((ctx: ActiveContext) => {
    setActiveContextState(ctx);
    setTransformTogglesState({ showHelp: false, showDebug: false });
    setShowingDatasourceHelp(false);
    const ref = ctx.view === 'data' ? selectionToCardRef(ctx.selection) : null;
    setSelectedItemsState(ref ? [ref] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /**
   * Finalizes the expression picker: creates the expression query at the
   * insertion point stored in activeContext.selection, then selects it.
   * Uses activeContextRef so this callback stays stable across navigations.
   */
  const finalizeExpressionPicker = useCallback(
    (type: ExpressionQueryType) => {
      const ctx = activeContextRef.current;
      const insertAfterRefId =
        ctx.view === 'data' && ctx.selection.kind === 'expressionPicker' ? ctx.selection.insertAfter : undefined;

      const baseQuery = expressionDatasource.newQuery();
      const queryWithDefaults = getDefaults({ ...baseQuery, type });

      const newRefId = dataPane.addQuery(queryWithDefaults, insertAfterRefId);
      if (newRefId) {
        setActiveContext({ view: 'data', selection: { kind: 'expression', refId: newRefId } });
      }
    },
    [dataPane, setActiveContext]
  );

  /**
   * Finalizes the transformation picker: creates the transformation at the
   * insertion point stored in activeContext.selection, then selects it.
   * Uses activeContextRef so this callback stays stable across navigations.
   */
  const finalizeTransformationPicker = useCallback(
    (transformationId: string) => {
      const ctx = activeContextRef.current;
      const insertAfterTransformId =
        ctx.view === 'data' && ctx.selection.kind === 'transformationPicker' ? ctx.selection.insertAfter : undefined;

      const newTransformId = addTransformationAction(transformationId, insertAfterTransformId);
      if (newTransformId) {
        setActiveContext({ view: 'data', selection: { kind: 'transformation', id: newTransformId } });
      }
    },
    [addTransformationAction, setActiveContext]
  );

  const { selectedQuery, selectedExpression, selectedTransformation, selectedAlert } = useSelectedCard(
    activeContext,
    queryRunnerState?.queries ?? [],
    transformations,
    alertingState.alertRules
  );

  const { selectedQueryDsData, selectedQueryDsLoading } = useSelectedQueryDatasource(selectedQuery, dsSettings);

  const uiState = useMemo(
    () => ({
      activeContext,
      setActiveContext,
      selectedQuery,
      selectedExpression,
      selectedTransformation,
      selectedAlert,
      selectedItems: selectedItemsState,
      setSelectedItems: setSelectedItemsState,
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
      transformToggles: { ...transformTogglesState, toggleHelp, toggleDebug },
      finalizeExpressionPicker,
      finalizeTransformationPicker,
    }),
    [
      activeContext,
      setActiveContext,
      selectedQuery,
      selectedExpression,
      selectedTransformation,
      selectedAlert,
      selectedItemsState,
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
      finalizeExpressionPicker,
      finalizeTransformationPicker,
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
    [dataPane, findTransformationIndex, addTransformationAction]
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
