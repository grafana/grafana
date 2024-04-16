import React, { PropsWithChildren, useState } from 'react';

import { QueriesDrawerContext, Tabs } from './QueriesDrawerContext';

type Props = {
  setDrawerOpened: () => {};
} & PropsWithChildren;

export function QueriesDrawerContextProviderMock(props: Props) {
  const [selectedTab, setSelectedTab] = useState<Tabs>(Tabs.QueryLibrary);
  const [drawerOpened, setDrawerOpened] = useState<boolean>(false);

  return (
    <QueriesDrawerContext.Provider
      value={{
        queryLibraryAvailable: true,
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
