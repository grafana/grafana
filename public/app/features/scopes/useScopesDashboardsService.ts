import { useObservable } from 'react-use';

import { getScopesDashboardsService } from './services';

export const useScopesDashboardsService = () => {
  const scopesDashboardsService = getScopesDashboardsService();

  if (!scopesDashboardsService) {
    return {
      state: {
        dashboards: [],
        filteredFolders: {},
        folders: {},
        forScopeNames: [],
        isLoading: false,
        isOpened: false,
        searchQuery: '',
      },
      updateFolder: () => undefined,
      changeSearchQuery: () => undefined,
      clearSearchQuery: () => undefined,
      toggleDrawer: () => undefined,
    };
  }

  const state = useObservable(scopesDashboardsService.stateObservable, scopesDashboardsService.state);

  return {
    state,
    updateFolder: scopesDashboardsService.updateFolder.bind(scopesDashboardsService),
    changeSearchQuery: scopesDashboardsService.changeSearchQuery.bind(scopesDashboardsService),
    clearSearchQuery: scopesDashboardsService.clearSearchQuery.bind(scopesDashboardsService),
    toggleDrawer: scopesDashboardsService.toggleDrawer.bind(scopesDashboardsService),
  };
};
