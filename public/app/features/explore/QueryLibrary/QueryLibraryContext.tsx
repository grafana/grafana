import { createContext, ReactNode, useContext } from 'react';

import { CoreApp } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import { OnSelectQueryType } from './types';

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
   * @param queryActionButton Action button will be shown in the library next to the query and can implement context
   *   specific actions with the library, like running the query or updating some query in the current app.
   * @param options.context Used for QueryEditor. Should identify the context this is called from, like 'explore' or
   *   'dashboard'.
   */
  openDrawer: (
    datasourceFilters: string[],
    onSelectQuery: OnSelectQueryType,
    options?: {
      isReplacingQuery?: boolean;
      context?: string;
      highlightQuery?: string;
    }
  ) => void;
  closeDrawer: () => void;
  isDrawerOpen: boolean;

  /**
   * Opens a modal for adding a query to the library.
   * @param query Query to be saved
   * @param options.onSave Callback that will be called after the query is saved.
   * @param options.context Used for rendering QueryEditor. Should identify the context this is called from, like 'explore' or
   *   'dashboard'.
   * @param options.title Default title for the modal, can be overridden by the query title.
   */
  openAddQueryModal: (
    query: DataQuery,
    options?: { onSave?: () => void; context?: string; title?: string; isDuplicating?: boolean }
  ) => void;
  closeAddQueryModal: () => void;

  /**
   * Returns a predefined small button that can be used to save a query to the library.
   * @param query
   */
  renderSaveQueryButton: (
    query: DataQuery,
    app?: CoreApp,
    queryLibraryRef?: string,
    onUpdateSuccess?: () => void
  ) => ReactNode;
  queryLibraryEnabled: boolean;
  context: string;
};

export const QueryLibraryContext = createContext<QueryLibraryContextType>({
  openDrawer: () => {},
  closeDrawer: () => {},
  isDrawerOpen: false,

  openAddQueryModal: () => {},
  closeAddQueryModal: () => {},

  renderSaveQueryButton: () => {
    return null;
  },

  queryLibraryEnabled: false,
  context: 'unknown',
});

export function useQueryLibraryContext() {
  return useContext(QueryLibraryContext);
}
