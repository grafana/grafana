import { PropsWithChildren } from 'react';

import { QueryLibraryContext } from './QueryLibraryContext';
import { QueryLibraryTab } from './types';

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
        renderSavedQueryButtons: jest.fn(),
        renderQueryLibraryEditingHeader: jest.fn(),
        queryLibraryEnabled: Boolean(props.queryLibraryEnabled),
        context: 'explore',
        triggerAnalyticsEvent: jest.fn(),
        setNewQuery: jest.fn(),
        onSelectQuery: jest.fn(),
        onFavorite: jest.fn(),
        onUnfavorite: jest.fn(),
        userFavorites: {},
        isEditingQuery: false,
        activeTab: QueryLibraryTab.ALL,
        activeDatasources: [],
        setActiveTab: jest.fn(),
        onTabChange: jest.fn(),
        setIsEditingQuery: jest.fn(),
        onAddHistoryQueryToLibrary: jest.fn(),
        highlightedQuery: undefined,
        newQuery: undefined,
        setCloseGuard: jest.fn(),
      }}
    >
      {props.children}
    </QueryLibraryContext.Provider>
  );
}
