import { createContext, useContext, ReactNode } from 'react';

import { DataSourceApi, DataSourceInstanceSettings, PanelData } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';

// Core context: panel, datasource (rarely changes)
interface QueryEditorCoreContextValue {
  panel: VizPanel;
  datasource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
}

const QueryEditorCoreContext = createContext<QueryEditorCoreContextValue | null>(null);

export function useQueryEditorCore(): QueryEditorCoreContextValue {
  const context = useContext(QueryEditorCoreContext);
  if (!context) {
    throw new Error('useQueryEditorCore must be used within QueryEditorProvider');
  }
  return context;
}

// Queries context: query list (changes on user action)
interface QueryEditorQueriesContextValue {
  queries: DataQuery[];
}

const QueryEditorQueriesContext = createContext<QueryEditorQueriesContextValue | null>(null);

export function useQueryEditorQueries(): QueryEditorQueriesContextValue {
  const context = useContext(QueryEditorQueriesContext);
  if (!context) {
    throw new Error('useQueryEditorQueries must be used within QueryEditorProvider');
  }
  return context;
}

// Granular hook
export function useQueries(): DataQuery[] {
  return useQueryEditorQueries().queries;
}

// Data context: query results (changes frequently)
interface QueryEditorDataContextValue {
  data?: PanelData;
  isLoading: boolean;
  error?: Error;
}

const QueryEditorDataContext = createContext<QueryEditorDataContextValue | null>(null);

export function useQueryEditorData(): QueryEditorDataContextValue {
  const context = useContext(QueryEditorDataContext);
  if (!context) {
    throw new Error('useQueryEditorData must be used within QueryEditorProvider');
  }
  return context;
}

// Actions context: mutation functions (stable, never changes)
interface QueryEditorActionsContextValue {
  // Query mutations
  updateQueries: (queries: DataQuery[]) => void;
  addQuery: (query?: Partial<DataQuery>) => void;
  deleteQuery: (index: number) => void;
  duplicateQuery: (index: number) => void;

  // Execution
  runQueries: () => void;

  // Datasource
  changeDataSource: (settings: DataSourceInstanceSettings) => void;
}

const QueryEditorActionsContext = createContext<QueryEditorActionsContextValue | null>(null);

export function useQueryEditorActions(): QueryEditorActionsContextValue {
  const context = useContext(QueryEditorActionsContext);
  if (!context) {
    throw new Error('useQueryEditorActions must be used within QueryEditorProvider');
  }
  return context;
}

interface QueryEditorProviderProps {
  children: ReactNode;
  core: QueryEditorCoreContextValue;
  queries: QueryEditorQueriesContextValue;
  data: QueryEditorDataContextValue;
  actions: QueryEditorActionsContextValue;
}

// Provides query editor state via multiple contexts
export function QueryEditorProvider({ children, core, queries, data, actions }: QueryEditorProviderProps) {
  return (
    <QueryEditorActionsContext.Provider value={actions}>
      <QueryEditorCoreContext.Provider value={core}>
        <QueryEditorQueriesContext.Provider value={queries}>
          <QueryEditorDataContext.Provider value={data}>{children}</QueryEditorDataContext.Provider>
        </QueryEditorQueriesContext.Provider>
      </QueryEditorCoreContext.Provider>
    </QueryEditorActionsContext.Provider>
  );
}
