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
        openAddQueryModal: jest.fn(),
        closeAddQueryModal: jest.fn(),
        renderSaveQueryButton: jest.fn(),
        queryLibraryEnabled: Boolean(props.queryLibraryEnabled),
      }}
    >
      {props.children}
    </QueryLibraryContext.Provider>
  );
}
