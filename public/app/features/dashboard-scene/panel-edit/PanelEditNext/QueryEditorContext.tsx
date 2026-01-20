import { createContext, ReactNode, useContext } from 'react';

import { DataSourceApi, DataSourceInstanceSettings, PanelData } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';

export interface QueryEditorState {
  panel: VizPanel;
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
  queries: DataQuery[];
  data?: PanelData;
  isLoading: boolean;
  error?: Error;
}

export interface QueryEditorActions {
  updateQueries: (queries: DataQuery[]) => void;
  addQuery: (query?: Partial<DataQuery>) => void;
  deleteQuery: (index: number) => void;
  duplicateQuery: (index: number) => void;
  runQueries: () => void;
  changeDataSource: (settings: DataSourceInstanceSettings) => void;
}

const StateContext = createContext<QueryEditorState | null>(null);
const ActionsContext = createContext<QueryEditorActions | null>(null);

export function useQueryEditorState(): QueryEditorState {
  const context = useContext(StateContext);
  if (!context) {
    throw new Error('useQueryEditorState must be used within QueryEditorProvider');
  }
  return context;
}

export function useQueryEditorActions(): QueryEditorActions {
  const context = useContext(ActionsContext);
  if (!context) {
    throw new Error('useQueryEditorActions must be used within QueryEditorProvider');
  }
  return context;
}

interface QueryEditorProviderProps {
  children: ReactNode;
  state: QueryEditorState;
  actions: QueryEditorActions;
}

export function QueryEditorProvider({ children, state, actions }: QueryEditorProviderProps) {
  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  );
}
