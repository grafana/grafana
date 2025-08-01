import { PropsWithChildren } from 'react';

import { QueryLibraryContext } from './QueryLibraryContext';

type Props = {
  queryLibraryEnabled?: boolean;
};

export function QueryLibraryContextProviderMock(props: PropsWithChildren<Props>) {
  return (
    <QueryLibraryContext.Provider
      value={{
        openDrawer: jest.fn(),
        closeDrawer: jest.fn(),
        isDrawerOpen: false,
        renderSaveQueryButton: jest.fn(),
        queryLibraryEnabled: Boolean(props.queryLibraryEnabled),
        context: 'explore',
        setActiveQuery: jest.fn(),
      }}
    >
      {props.children}
    </QueryLibraryContext.Provider>
  );
}
