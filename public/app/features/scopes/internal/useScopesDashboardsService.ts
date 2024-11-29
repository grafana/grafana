import { useObservable } from 'react-use';

import { scopesDashboardsService } from './ScopesDashboardsService';

export const useScopesDashboardsService = () => {
  const state = useObservable(scopesDashboardsService.stateObservable, scopesDashboardsService.state);

  return {
    state,
    updateFolder: scopesDashboardsService.updateFolder.bind(scopesDashboardsService),
    changeSearchQuery: scopesDashboardsService.changeSearchQuery.bind(scopesDashboardsService),
    clearSearchQuery: scopesDashboardsService.clearSearchQuery.bind(scopesDashboardsService),
  };
};
