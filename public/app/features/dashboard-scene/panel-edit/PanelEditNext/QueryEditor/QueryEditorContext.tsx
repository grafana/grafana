import { createContext, ReactNode, useContext } from 'react';

import { DataSourceApi, DataSourceInstanceSettings, PanelData } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { QueryGroupOptions } from 'app/types/query';

import { Transformation } from './types';

export interface DatasourceState {
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
  dsError?: Error;
}

export interface QueryRunnerState {
  queries: DataQuery[];
  data?: PanelData;
  isLoading: boolean;
}

export interface PanelState {
  panel: VizPanel;
  transformations: Transformation[];
}

export interface QueryEditorUIState {
  selectedQuery: DataQuery | null;
  selectedTransformation: Transformation | null;
  setSelectedQuery: (query: DataQuery | null) => void;
  setSelectedTransformation: (transformation: Transformation | null) => void;
}

export interface QueryEditorActions {
  updateQueries: (queries: DataQuery[]) => void;
  updateSelectedQuery: (updatedQuery: DataQuery, originalRefId: string) => void;
  addQuery: (query?: Partial<DataQuery>) => void;
  deleteQuery: (index: number) => void;
  duplicateQuery: (index: number) => void;
  runQueries: () => void;
  changeDataSource: (settings: DataSourceInstanceSettings, queryRefId: string) => void;
}

export interface QueryOptionsState {
  options: QueryGroupOptions;
  onChange: (options: QueryGroupOptions) => void;
}

const DatasourceContext = createContext<DatasourceState | null>(null);
const QueryRunnerContext = createContext<QueryRunnerState | null>(null);
const PanelContext = createContext<PanelState | null>(null);
const QueryEditorUIContext = createContext<QueryEditorUIState | null>(null);
const ActionsContext = createContext<QueryEditorActions | null>(null);
const QueryOptionsContext = createContext<QueryOptionsState | null>(null);

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

export function useQueryOptionsContext(): QueryOptionsState {
  const context = useContext(QueryOptionsContext);
  if (!context) {
    throw new Error('useQueryOptionsContext must be used within QueryEditorProvider');
  }
  return context;
}

interface QueryEditorProviderProps {
  children: ReactNode;
  dsState: DatasourceState;
  qrState: QueryRunnerState;
  panelState: PanelState;
  uiState: QueryEditorUIState;
  actions: QueryEditorActions;
  queryOptionsState: QueryOptionsState;
}

export function QueryEditorProvider({
  children,
  dsState,
  qrState,
  panelState,
  uiState,
  actions,
  queryOptionsState,
}: QueryEditorProviderProps) {
  return (
    <ActionsContext.Provider value={actions}>
      <DatasourceContext.Provider value={dsState}>
        <QueryRunnerContext.Provider value={qrState}>
          <PanelContext.Provider value={panelState}>
            <QueryEditorUIContext.Provider value={uiState}>
              <QueryOptionsContext.Provider value={queryOptionsState}>{children}</QueryOptionsContext.Provider>
            </QueryEditorUIContext.Provider>
          </PanelContext.Provider>
        </QueryRunnerContext.Provider>
      </DatasourceContext.Provider>
    </ActionsContext.Provider>
  );
}
