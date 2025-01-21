import { PropsWithChildren, useState, createContext, useContext, useCallback } from 'react';

import { config } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema/dist/esm/veneer/common.types';

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

  activeDatasources: string[] | undefined;
  openDrawer: (datasources: string[] | undefined) => void;
  closeDrawer: () => void;

  activeQuery: DataQuery | undefined;
  addQueryModalOpened: boolean;
  openAddQueryModal: (query: DataQuery) => void;
  closeAddQueryModal: () => void;
};

export const QueryLibraryContext = createContext<QueryLibraryContextType>({
  queryLibraryAvailable: false,
  drawerOpened: false,

  activeDatasources: undefined,
  openDrawer: () => {},
  closeDrawer: () => {},

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

  const openDrawer = useCallback((datasources: string[] | undefined) => {
    setActiveDatasources(datasources);
    setDrawerOpened(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setActiveDatasources(undefined);
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
      }}
    >
      {children}
    </QueryLibraryContext.Provider>
  );
}
