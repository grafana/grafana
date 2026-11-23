import { type PropsWithChildren, useState, createContext, useContext } from 'react';

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

  const [prevSettings, setPrevSettings] = useState<typeof settings>();
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    if (settings) {
      setSelectedTab(settings.starredTabAsFirstTab ? Tabs.Starred : Tabs.RichHistory);
    }
  }

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
