import { PropsWithChildren, useState, createContext, useContext, useCallback, ComponentType } from 'react';

import { DataQuery } from '@grafana/schema';

import { AddToQueryLibraryModal } from './AddToQueryLibraryModal';
import { QueryLibraryDrawer } from './QueryLibraryDrawer';

/**
 * Context with state and action to interact with Query Library. The Query Library feature consists of a drawer
 * that shows existing queries and allows users to use them and manage them and then an AddQueryModal which allows
 * users to save a query into the library. Both of those are included in Grafana AppChrome component.
 *
 * Use this context to interact with those components, showing, hiding and setting initial state for them.
 */
type QueryLibraryContextType = {
  /**
   * Opens a drawer with query library.
   * @param datasources Data sources that will be used for initial filter in the library.
   * @param queryActionButton Action button will be shown in the library next to the query and can implement context
   *   specific actions with the library, like running the query or updating some query in the current app.
   */
  openDrawer: (datasources: string[] | undefined, queryActionButton?: QueryActionButton) => void;
  closeDrawer: () => void;
  isDrawerOpen: boolean;
  queryActionButton: QueryActionButton | undefined;

  /**
   * Opens a modal for adding a query to the library.
   * @param query
   */
  openAddQueryModal: (query: DataQuery) => void;
  closeAddQueryModal: () => void;
};

export type QueryActionButtonProps = {
  queries: DataQuery[];
  datasourceUid?: string;
  onClick: () => void;
};

export type QueryActionButton = ComponentType<QueryActionButtonProps>;

export const QueryLibraryContext = createContext<QueryLibraryContextType>({
  openDrawer: () => {},
  closeDrawer: () => {},
  isDrawerOpen: false,
  queryActionButton: undefined,

  openAddQueryModal: () => {},
  closeAddQueryModal: () => {},
});

export function useQueryLibraryContext() {
  return useContext(QueryLibraryContext);
}

export function QueryLibraryContextProvider({ children }: PropsWithChildren) {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeDatasources, setActiveDatasources] = useState<string[] | undefined>(undefined);
  const [isAddQueryModalOpen, setIsAddQueryModalOpen] = useState<boolean>(false);
  const [activeQuery, setActiveQuery] = useState<DataQuery | undefined>(undefined);
  const [queryActionButton, setQueryActionButton] = useState<QueryActionButton | undefined>(undefined);

  const openDrawer = useCallback(
    (datasources: string[] | undefined, queryActionButton: QueryActionButton | undefined) => {
      setActiveDatasources(datasources);
      // Because the queryActionButton can be a function component it would be called as a callback if just passed in.
      setQueryActionButton(() => queryActionButton);
      setIsDrawerOpen(true);
    },
    []
  );

  const closeDrawer = useCallback(() => {
    setActiveDatasources(undefined);
    setQueryActionButton(undefined);
    setIsDrawerOpen(false);
  }, []);

  const openAddQueryModal = useCallback((query: DataQuery) => {
    setActiveQuery(query);
    setIsAddQueryModalOpen(true);
  }, []);

  const closeAddQueryModal = useCallback(() => {
    setActiveQuery(undefined);
    setIsAddQueryModalOpen(false);
  }, []);

  return (
    <QueryLibraryContext.Provider
      value={{
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        openAddQueryModal,
        closeAddQueryModal,
        queryActionButton,
      }}
    >
      {children}
      <QueryLibraryDrawer close={closeDrawer} activeDatasources={activeDatasources} isOpen={isDrawerOpen} />
      <AddToQueryLibraryModal isOpen={isAddQueryModalOpen} query={activeQuery} close={closeAddQueryModal} />
    </QueryLibraryContext.Provider>
  );
}
