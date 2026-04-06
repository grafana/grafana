import { createContext, type ReactNode, useContext } from 'react';

import {
  type DataQueryError,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type DataTransformerConfig,
  type PanelData,
} from '@grafana/data';
import { type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { type ExpressionQuery, type ExpressionQueryType } from 'app/features/expressions/types';
import { type QueryGroupOptions } from 'app/types/query';

import { type QueryEditorType } from '../constants';

import { type AlertRule, type QueryOptionField, type Transformation } from './types';

export interface PendingExpression {
  insertAfter: string;
}

export interface PendingSavedQuery {
  insertAfter: string;
}

export interface PendingTransformation {
  insertAfter?: string;
  showPicker?: boolean;
}

export interface DatasourceState {
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
  dsError?: Error;
}

export interface QueryRunnerState {
  queries: DataQuery[];
  data?: PanelData;
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

export interface TransformationToggleState {
  showHelp: boolean;
  showDebug: boolean;
}

interface TransformationToggles extends TransformationToggleState {
  toggleHelp: () => void;
  toggleDebug: () => void;
}

export interface QueryEditorUIState {
  selectedQuery: DataQuery | ExpressionQuery | null;
  selectedTransformation: Transformation | null;
  selectedAlert: AlertRule | null;
  /**
   * Ordered selection array. The last element is the primary (editor-visible) item.
   * Single-select is always a single-element array; multi-select adds to the end.
   */
  selectedQueryRefIds: readonly string[];
  /**
   * Ordered selection array. The last element is the primary (editor-visible) item.
   * Single-select is always a single-element array; multi-select adds to the end.
   */
  selectedTransformationIds: readonly string[];
  setSelectedQuery: (query: DataQuery | ExpressionQuery | null) => void;
  setSelectedTransformation: (transformation: Transformation | null) => void;
  setSelectedAlert: (alert: AlertRule | null) => void;
  queryOptions: QueryOptionsState;
  selectedQueryDsData: {
    datasource?: DataSourceApi;
    dsSettings?: DataSourceInstanceSettings;
  } | null;
  selectedQueryDsLoading: boolean;
  showingDatasourceHelp: boolean;
  toggleDatasourceHelp: () => void;
  transformToggles: TransformationToggles;
  cardType: QueryEditorType;
  pendingExpression: PendingExpression | null;
  setPendingExpression: (pending: PendingExpression | null) => void;
  finalizePendingExpression: (type: ExpressionQueryType) => void;
  pendingSavedQuery: PendingSavedQuery | null;
  setPendingSavedQuery: (pending: PendingSavedQuery | null) => void;
  pendingTransformation: PendingTransformation | null;
  setPendingTransformation: (pending: PendingTransformation | null) => void;
  finalizePendingTransformation: (transformationId: string) => void;
  showVersionBanner: boolean;
}

export interface QueryEditorActions {
  onSwitchToClassic?: () => void;
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
