import { PropsWithChildren, useState, createContext, useContext, useEffect } from 'react';

import { useSelector } from 'app/types/store';

import { selectRichHistorySettings } from '../state/selectors';

export enum Tabs {
  RichHistory = 'Query history',
  Starred = 'Starred',
  Settings = 'Settings',
}

type RichHistoryContextType = {
  selectedTab: Tabs;
  setSelectedTab: (tab: Tabs) => void;
  drawerOpened: boolean;
  setDrawerOpened: (value: boolean) => void;
};

export const QueriesDrawerContext = createContext<RichHistoryContextType>({
  selectedTab: Tabs.RichHistory,
  setSelectedTab: () => {},
  drawerOpened: false,
  setDrawerOpened: () => {},
});

export function useQueriesDrawerContext() {
  return useContext(QueriesDrawerContext);
}

export function QueriesDrawerContextProvider({ children }: PropsWithChildren) {
  const [selectedTab, setSelectedTab] = useState<Tabs>(Tabs.RichHistory);
  const [drawerOpened, setDrawerOpened] = useState<boolean>(false);

  const settings = useSelector(selectRichHistorySettings);

  useEffect(() => {
    if (settings) {
      setSelectedTab(settings.starredTabAsFirstTab ? Tabs.Starred : Tabs.RichHistory);
    }
  }, [settings, setSelectedTab]);

  return (
    <QueriesDrawerContext.Provider
      value={{
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
