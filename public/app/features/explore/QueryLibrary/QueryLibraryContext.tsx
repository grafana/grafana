import { PropsWithChildren, useState, createContext, useContext, useCallback, ComponentType } from 'react';

import { config } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

/**
 * Context with state and action to interact with Query Library. The Query Library feature consists of a drawer
 * that shows existing queries and allows users to use them and manage them and then an AddQueryModal which allows
 * users to save a query into the library. Both of those are included in Grafana AppChrome component.
 *
 * Use this context to interact with those components, showing, hiding and setting initial state for them.
 */
type QueryLibraryContextType = {
  queryLibraryAvailable: boolean;
  drawerOpened: boolean;

  /**
   * Opens a drawer with query library.
   * @param datasources Data sources that will be used for initial filter in the library.
   * @param queryActionButton Action button will be shown in the library next to the query and can implement context
   *   specific actions with the library, like running the query or updating some query in the current app.
   */
  openDrawer: (datasources: string[] | undefined, queryActionButton?: QueryActionButton) => void;
  closeDrawer: () => void;
  activeDatasources: string[] | undefined;
  queryActionButton: QueryActionButton | undefined;

  activeQuery: DataQuery | undefined;
  addQueryModalOpened: boolean;

  /**
   * Opens a modal for adding a query to the library.
   * @param query
   */
  openAddQueryModal: (query: DataQuery) => void;
  closeAddQueryModal: () => void;
};

export type QueryActionButton = ComponentType<{
  queries: DataQuery[];
  datasourceUid?: string;
  onClick: () => void;
}>;

export const QueryLibraryContext = createContext<QueryLibraryContextType>({
  queryLibraryAvailable: false,
  drawerOpened: false,

  activeDatasources: undefined,
  openDrawer: () => {},
  closeDrawer: () => {},
  queryActionButton: undefined,

  activeQuery: undefined,
  addQueryModalOpened: false,
  openAddQueryModal: () => {},
  closeAddQueryModal: () => {},
});

export function useQueryLibraryContext() {
  return useContext(QueryLibraryContext);
}

export function QueryLibraryDrawerContextProvider({ children }: PropsWithChildren) {
  const queryLibraryAvailable = config.featureToggles.queryLibrary === true;
  const [drawerOpened, setDrawerOpened] = useState<boolean>(false);
  const [activeDatasources, setActiveDatasources] = useState<string[] | undefined>(undefined);
  const [addQueryModalOpened, setAddQueryModalOpened] = useState<boolean>(false);
  const [activeQuery, setActiveQuery] = useState<DataQuery | undefined>(undefined);
  const [queryActionButton, setQueryActionButton] = useState<QueryActionButton | undefined>(undefined);

  const openDrawer = useCallback(
    (datasources: string[] | undefined, queryActionButton: QueryActionButton | undefined) => {
      setActiveDatasources(datasources);
      // Because the queryActionButton can be a function component it would be called as a callback if just passed in.
      setQueryActionButton(() => queryActionButton);
      setDrawerOpened(true);
    },
    []
  );

  const closeDrawer = useCallback(() => {
    setActiveDatasources(undefined);
    setQueryActionButton(undefined);
    setDrawerOpened(false);
  }, []);

  const openAddQueryModal = useCallback((query: DataQuery) => {
    setActiveQuery(query);
    setAddQueryModalOpened(true);
  }, []);

  const closeAddQueryModal = useCallback(() => {
    setActiveQuery(undefined);
    setAddQueryModalOpened(false);
  }, []);

  return (
    <QueryLibraryContext.Provider
      value={{
        queryLibraryAvailable,
        drawerOpened,
        openDrawer,
        closeDrawer,
        addQueryModalOpened,
        openAddQueryModal,
        closeAddQueryModal,
        activeDatasources,
        activeQuery,
        queryActionButton,
      }}
    >
      {children}
    </QueryLibraryContext.Provider>
  );
}
