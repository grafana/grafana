import { createContext, ReactNode, useContext } from 'react';

import { CoreApp } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import { OnSelectQueryType, QueryTemplate } from './types';

export type QueryLibraryDrawerOptions = {
  datasourceFilters?: string[];
  onSelectQuery?: OnSelectQueryType;
  options?: { isReplacingQuery?: boolean; onSave?: () => void; context?: string; highlightQuery?: string };
  query?: DataQuery;
};

/**
 * Context with state and action to interact with Query Library. The Query Library feature consists of a drawer
 * that shows existing queries and allows users to use them and manage them and then an AddQueryModal which allows
 * users to save a query into the library. Both of those are included in Grafana AppChrome component.
 *
 * Use this context to interact with those components, showing, hiding and setting initial state for them.
 */
export type QueryLibraryContextType = {
  /**
   * Opens a drawer with query library.
   * @param datasourceFilters Data source names that will be used for initial filter in the library.
   * @param onSelectQuery Callback to be called when a query is selected from the library.
   * @param options.context Used for QueryEditor. Should identify the context this is called from, like 'explore' or
   *   'dashboard'.
   * @param newQuery New query to be added to the library.
   */
  openDrawer: (options: QueryLibraryDrawerOptions) => void;
  closeDrawer: () => void;
  isDrawerOpen: boolean;
  onSave?: () => void;

  /**
   * Returns a predefined small button that can be used to save a query to the library.
   * @param query
   */
  renderSaveQueryButton: (
    query: DataQuery,
    app?: CoreApp,
    queryLibraryRef?: string,
    onUpdateSuccess?: () => void,
    onSelectQuery?: (query: DataQuery) => void
  ) => ReactNode;
  queryLibraryEnabled: boolean;
  context: string;
  setNewQuery: (query?: QueryTemplate) => void;
};

export const QueryLibraryContext = createContext<QueryLibraryContextType>({
  openDrawer: () => {},
  closeDrawer: () => {},
  isDrawerOpen: false,

  setNewQuery: () => {},
  onSave: () => {},

  renderSaveQueryButton: () => {
    return null;
  },

  queryLibraryEnabled: false,
  context: 'unknown',
});

export function useQueryLibraryContext() {
  return useContext(QueryLibraryContext);
}
