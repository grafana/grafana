import { PropsWithChildren, useState, createContext, useContext, useCallback, useMemo } from 'react';

import { DataQuery } from '@grafana/schema';

import { AddToQueryLibraryModal } from './AddToQueryLibraryModal';
import { QueryLibraryDrawer } from './QueryLibraryDrawer';
import { QueryActionButton, QueryActionButtonProps } from './types';

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
   */
  openDrawer: (datasourceFilters: string[], queryActionButton: QueryActionButton) => void;
  closeDrawer: () => void;
  isDrawerOpen: boolean;

  /**
   * Opens a modal for adding a query to the library.
   * @param query
   */
  openAddQueryModal: (query: DataQuery) => void;
  closeAddQueryModal: () => void;
};

export const QueryLibraryContext = createContext<QueryLibraryContextType>({
  openDrawer: () => {},
  closeDrawer: () => {},
  isDrawerOpen: false,

  openAddQueryModal: () => {},
  closeAddQueryModal: () => {},
});

export function useQueryLibraryContext() {
  return useContext(QueryLibraryContext);
}

export function QueryLibraryContextProvider({ children }: PropsWithChildren) {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeDatasources, setActiveDatasources] = useState<string[]>([]);
  const [isAddQueryModalOpen, setIsAddQueryModalOpen] = useState<boolean>(false);
  const [activeQuery, setActiveQuery] = useState<DataQuery | undefined>(undefined);
  const [queryActionButton, setQueryActionButton] = useState<QueryActionButton | undefined>(undefined);

  const openDrawer = useCallback((datasourceFilters: string[], queryActionButton: QueryActionButton) => {
    setActiveDatasources(datasourceFilters);
    // Because the queryActionButton can be a function component it would be called as a callback if just passed in.
    setQueryActionButton(() => queryActionButton);
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setActiveDatasources([]);
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

  // We wrap the action button one time to add the closeDrawer behaviour. This way whoever injects the action button
  // does not need to remember to do it nor the query table inside that renders it needs to know about the drawer.
  const finalActionButton = useMemo(() => {
    if (!queryActionButton) {
      return queryActionButton;
    }
    return (props: QueryActionButtonProps) => {
      const QButton = queryActionButton;
      return (
        <QButton
          {...props}
          onClick={() => {
            props.onClick();
            closeDrawer();
          }}
        />
      );
    };
  }, [closeDrawer, queryActionButton]);

  return (
    <QueryLibraryContext.Provider
      value={{
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        openAddQueryModal,
        closeAddQueryModal,
      }}
    >
      {children}
      <QueryLibraryDrawer
        isOpen={isDrawerOpen}
        close={closeDrawer}
        activeDatasources={activeDatasources}
        queryActionButton={finalActionButton}
      />
      <AddToQueryLibraryModal isOpen={isAddQueryModalOpen} close={closeAddQueryModal} query={activeQuery} />
    </QueryLibraryContext.Provider>
  );
}
