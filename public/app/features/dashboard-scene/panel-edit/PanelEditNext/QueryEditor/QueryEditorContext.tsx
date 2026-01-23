import { createContext, ReactNode, useContext } from 'react';

import { DataSourceApi, DataSourceInstanceSettings, PanelData } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';

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
}

export interface QueryEditorActions {
  updateQueries: (queries: DataQuery[]) => void;
  addQuery: (query?: Partial<DataQuery>) => void;
  deleteQuery: (index: number) => void;
  duplicateQuery: (index: number) => void;
  runQueries: () => void;
  changeDataSource: (settings: DataSourceInstanceSettings) => void;
}

const DatasourceContext = createContext<DatasourceState | null>(null);
const QueryRunnerContext = createContext<QueryRunnerState | null>(null);
const PanelContext = createContext<PanelState | null>(null);
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

export function useActionsContext(): QueryEditorActions {
  const context = useContext(ActionsContext);
  if (!context) {
    throw new Error('useActionsContext must be used within QueryEditorProvider');
  }
  return context;
}

interface QueryEditorProviderProps {
  children: ReactNode;
  dsState: DatasourceState;
  qrState: QueryRunnerState;
  panelState: PanelState;
  actions: QueryEditorActions;
}

export function QueryEditorProvider({ children, dsState, qrState, panelState, actions }: QueryEditorProviderProps) {
  return (
    <ActionsContext.Provider value={actions}>
      <DatasourceContext.Provider value={dsState}>
        <QueryRunnerContext.Provider value={qrState}>
          <PanelContext.Provider value={panelState}>{children}</PanelContext.Provider>
        </QueryRunnerContext.Provider>
      </DatasourceContext.Provider>
    </ActionsContext.Provider>
  );
}
