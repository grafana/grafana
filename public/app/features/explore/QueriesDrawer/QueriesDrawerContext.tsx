import React, { PropsWithChildren, useState, createContext, useContext, useEffect } from 'react';

import { config } from '@grafana/runtime';
import { useSelector } from 'app/types';

import { selectRichHistorySettings } from '../state/selectors';

export enum Tabs {
  QueryLibrary = 'Query library',
  RichHistory = 'Query history',
  Starred = 'Starred',
  Settings = 'Settings',
}

type QueryLibraryContextType = {
  selectedTab?: Tabs;
  setSelectedTab: (tab: Tabs) => void;
  queryLibraryAvailable: boolean;
  drawerOpened: boolean;
  setDrawerOpened: (value: boolean) => void;
};

export const QueriesDrawerContext = createContext<QueryLibraryContextType>({
  selectedTab: undefined,
  setSelectedTab: () => {},
  queryLibraryAvailable: false,
  drawerOpened: false,
  setDrawerOpened: () => {},
});

export function useQueryLibraryContext() {
  return useContext(QueriesDrawerContext);
}

export function QueryLibraryContextProvider({ children }: PropsWithChildren) {
  const queryLibraryAvailable = config.featureToggles.queryLibrary === true;
  const [selectedTab, setSelectedTab] = useState<Tabs | undefined>(
    queryLibraryAvailable ? Tabs.QueryLibrary : undefined
  );
  const [drawerOpened, setDrawerOpened] = useState<boolean>(false);

  const settings = useSelector(selectRichHistorySettings);

  useEffect(() => {
    if (settings && !queryLibraryAvailable) {
      setSelectedTab(settings.starredTabAsFirstTab ? Tabs.Starred : Tabs.RichHistory);
    }
  }, [settings, setSelectedTab, queryLibraryAvailable]);

  return (
    <QueriesDrawerContext.Provider
      value={{
        queryLibraryAvailable,
        selectedTab,
        setSelectedTab,
        drawerOpened,
        setDrawerOpened,
      }}
    >
      {children}
    </QueriesDrawerContext.Provider>
  );
}
