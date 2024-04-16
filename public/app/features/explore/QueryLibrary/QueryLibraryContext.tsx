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
  // The value is determined in runtime based on featureToggle and user preferences (see RichHistoryContainer)
  selectedTab?: Tabs;
  setSelectedTab: (tab: Tabs) => void;
  enabled: boolean;
  drawerOpened: boolean;
  setDrawerOpened: (value: boolean) => void;
};

export const QueryLibraryContext = createContext<QueryLibraryContextType>({
  selectedTab: undefined,
  setSelectedTab: () => {},
  enabled: false,
  drawerOpened: false,
  setDrawerOpened: () => {},
});

export function useQueryLibraryContext() {
  return useContext(QueryLibraryContext);
}

export function QueryLibraryContextProvider({ children }: PropsWithChildren) {
  const enabled = config.featureToggles.queryLibrary === true;
  const [selectedTab, setSelectedTab] = useState<Tabs | undefined>(enabled ? Tabs.QueryLibrary : undefined);
  const [drawerOpened, setDrawerOpened] = useState<boolean>(false);

  const settings = useSelector(selectRichHistorySettings);

  useEffect(() => {
    if (settings && !enabled) {
      setSelectedTab(settings.starredTabAsFirstTab ? Tabs.Starred : Tabs.RichHistory);
    }
  }, [settings, setSelectedTab]);

  return (
    <QueryLibraryContext.Provider
      value={{
        enabled,
        selectedTab,
        setSelectedTab,
        drawerOpened,
        setDrawerOpened,
      }}
    >
      {children}
    </QueryLibraryContext.Provider>
  );
}
