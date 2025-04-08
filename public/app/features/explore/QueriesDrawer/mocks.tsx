import { PropsWithChildren, useState } from 'react';

import { QueriesDrawerContext, Tabs } from './QueriesDrawerContext';

type Props = {
  setDrawerOpened?: (value: boolean) => {};
  queryLibraryEnabled?: boolean;
} & PropsWithChildren;

export function QueriesDrawerContextProviderMock(props: Props) {
  const [selectedTab, setSelectedTab] = useState<Tabs>(Tabs.RichHistory);
  const [drawerOpened, setDrawerOpened] = useState<boolean>(false);

  return (
    <QueriesDrawerContext.Provider
      value={{
        selectedTab,
        setSelectedTab,
        drawerOpened,
        setDrawerOpened: (value) => {
          props.setDrawerOpened?.(value);
          setDrawerOpened(value);
        },
      }}
    >
      {props.children}
    </QueriesDrawerContext.Provider>
  );
}
