import { createContext, useContext } from 'react';

import { CoreApp } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

export type QueryHistoryDrawerOptions = {
  datasourceFilters?: string[];
  onSelectQuery?: (query: DataQuery) => void;
  options?: { context?: CoreApp | string };
};

/**
 * Context with state and action to interact with Query History. The Query History feature consists of a drawer
 * that shows existing query history and allows users to use them.
 *
 * Use this context to interact with those components, showing, hiding and setting initial state for them.
 */
export type QueryHistoryContextType = {
  /**
   * Opens a drawer with query history.
   * @param datasourceFilters Data source names that will be used for initial filter in the history.
   * @param onSelectQuery Callback to be called when a query is selected from the history.
   * @param options.context Used for QueryEditor. Should identify the context this is called from, like 'explore' or
   *   'alerting'.
   */
  openDrawer: (options: QueryHistoryDrawerOptions) => void;
  closeDrawer: () => void;
  isDrawerOpen: boolean;

  queryHistoryEnabled: boolean;
  context: string;
};

export const QueryHistoryContext = createContext<QueryHistoryContextType>({
  openDrawer: () => {},
  closeDrawer: () => {},
  isDrawerOpen: false,
  queryHistoryEnabled: false,
  context: 'unknown',
});

export function useQueryHistoryContext() {
  return useContext(QueryHistoryContext);
}
