import { createContext, ReactNode, useContext } from 'react';

import {
  DataQueryError,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataTransformerConfig,
  PanelData,
} from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { QueryGroupOptions } from 'app/types/query';

import { AlertRule, QueryOptionField, Transformation } from './types';

/**
 * The selected item within the data view.
 * A fully discriminated union — every kind is mutually exclusive at the type level.
 */
export type DataSelection =
  | { kind: 'none' }
  | { kind: 'query'; refId: string }
  | { kind: 'expression'; refId: string }
  | { kind: 'transformation'; id: string }
  | { kind: 'expressionPicker'; insertAfter: string }
  | { kind: 'transformationPicker'; insertAfter?: string; showPicker?: boolean };

/**
 * A typed reference to any card in the sidebar — used as the element type
 * for the multi-selection set (`selectedItems`).
 */
export type CardRef =
  | { kind: 'query'; refId: string }
  | { kind: 'expression'; refId: string }
  | { kind: 'transformation'; id: string }
  | { kind: 'alert'; alertId: string };

/**
 * Discriminated union representing what the user is currently viewing.
 * A single source of truth that encodes the selected card, active view,
 * and any pending picker state — all as a single atomic value.
 */
export type ActiveContext = { view: 'data'; selection: DataSelection } | { view: 'alerts'; alertId: string | null };

export const INITIAL_ACTIVE_CONTEXT: ActiveContext = {
  view: 'data',
  selection: { kind: 'none' },
};

export interface DatasourceState {
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
  dsError?: Error;
}

export interface QueryRunnerState {
  queries: DataQuery[];
  data?: PanelData;
  isLoading: boolean;
  queryError?: DataQueryError;
}

export interface AlertingState {
  alertRules: AlertRule[];
  loading: boolean;
  isDashboardSaved: boolean;
}

export interface PanelState {
  panel: VizPanel;
  transformations: Transformation[];
}

export interface QueryOptionsState {
  options: QueryGroupOptions;
  isQueryOptionsOpen: boolean;
  openSidebar: (focusField?: QueryOptionField) => void;
  closeSidebar: () => void;
  focusedField: QueryOptionField | null;
}

interface TransformationToggles {
  showHelp: boolean;
  toggleHelp: () => void;
  showDebug: boolean;
  toggleDebug: () => void;
}

export interface QueryEditorUIState {
  activeContext: ActiveContext;
  setActiveContext: (ctx: ActiveContext) => void;
  selectedQuery: DataQuery | null;
  selectedExpression: ExpressionQuery | null;
  selectedTransformation: Transformation | null;
  selectedAlert: AlertRule | null;
  selectedItems: CardRef[];
  setSelectedItems: (items: CardRef[]) => void;
  queryOptions: QueryOptionsState;
  selectedQueryDsData: {
    datasource?: DataSourceApi;
    dsSettings?: DataSourceInstanceSettings;
  } | null;
  selectedQueryDsLoading: boolean;
  showingDatasourceHelp: boolean;
  toggleDatasourceHelp: () => void;
  transformToggles: TransformationToggles;
  /** Finalizes the expression picker: creates the expression query and selects it. */
  finalizeExpressionPicker: (type: ExpressionQueryType) => void;
  /** Finalizes the transformation picker: creates the transformation and selects it. */
  finalizeTransformationPicker: (transformationId: string) => void;
}

export interface QueryEditorActions {
  updateQueries: (queries: DataQuery[]) => void;
  updateSelectedQuery: (updatedQuery: DataQuery, originalRefId: string) => void;
  addQuery: (query?: Partial<DataQuery>, afterRefId?: string) => string | undefined;
  deleteQuery: (refId: string) => void;
  duplicateQuery: (refId: string) => void;
  toggleQueryHide: (refId: string) => void;
  runQueries: () => void;
  changeDataSource: (settings: DataSourceInstanceSettings, queryRefId: string) => void;
  onQueryOptionsChange: (options: QueryGroupOptions) => void;
  addTransformation: (transformationId: string, afterTransformId?: string) => string | undefined;
  deleteTransformation: (transformId: string) => void;
  toggleTransformationDisabled: (transformId: string) => void;
  updateTransformation: (oldConfig: DataTransformerConfig, newConfig: DataTransformerConfig) => void;
  reorderTransformations: (transformations: DataTransformerConfig[]) => void;
}

const DatasourceContext = createContext<DatasourceState | null>(null);
const QueryRunnerContext = createContext<QueryRunnerState | null>(null);
const PanelContext = createContext<PanelState | null>(null);
const AlertingContext = createContext<AlertingState | null>(null);
const QueryEditorUIContext = createContext<QueryEditorUIState | null>(null);
const ActionsContext = createContext<QueryEditorActions | null>(null);

export function useDatasourceContext(): DatasourceState {
  const context = useContext(DatasourceContext);
  if (!context) {
    throw new Error('useDatasourceContext must be used within QueryEditorProvider');
  }
  return context;
}

export function useQueryRunnerContext(): QueryRunnerState {
  const context = useContext(QueryRunnerContext);
  if (!context) {
    throw new Error('useQueryRunnerContext must be used within QueryEditorProvider');
  }
  return context;
}

export function usePanelContext(): PanelState {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error('usePanelContext must be used within QueryEditorProvider');
  }
  return context;
}

export function useAlertingContext(): AlertingState {
  const context = useContext(AlertingContext);
  if (!context) {
    throw new Error('useAlertingContext must be used within QueryEditorProvider');
  }
  return context;
}

export function useActionsContext(): QueryEditorActions {
  const context = useContext(ActionsContext);
  if (!context) {
    throw new Error('useActionsContext must be used within QueryEditorProvider');
  }
  return context;
}

export function useQueryEditorUIContext(): QueryEditorUIState {
  const context = useContext(QueryEditorUIContext);
  if (!context) {
    throw new Error('useQueryEditorUIContext must be used within QueryEditorProvider');
  }
  return context;
}

interface QueryEditorProviderProps {
  children: ReactNode;
  dsState: DatasourceState;
  qrState: QueryRunnerState;
  panelState: PanelState;
  alertingState: AlertingState;
  uiState: QueryEditorUIState;
  actions: QueryEditorActions;
}

export function QueryEditorProvider({
  children,
  dsState,
  qrState,
  panelState,
  alertingState,
  uiState,
  actions,
}: QueryEditorProviderProps) {
  return (
    <ActionsContext.Provider value={actions}>
      <DatasourceContext.Provider value={dsState}>
        <QueryRunnerContext.Provider value={qrState}>
          <PanelContext.Provider value={panelState}>
            <AlertingContext.Provider value={alertingState}>
              <QueryEditorUIContext.Provider value={uiState}>{children}</QueryEditorUIContext.Provider>
            </AlertingContext.Provider>
          </PanelContext.Provider>
        </QueryRunnerContext.Provider>
      </DatasourceContext.Provider>
    </ActionsContext.Provider>
  );
}
