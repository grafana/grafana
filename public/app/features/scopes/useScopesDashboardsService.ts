import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { getScopesDashboardsService } from './services';

export const useScopesDashboardsService = () => {
  const scopesDashboardsService = getScopesDashboardsService();

  useObservable(scopesDashboardsService?.stateObservable ?? new Observable(), scopesDashboardsService?.state);

  return scopesDashboardsService
    ? {
        state: scopesDashboardsService.state,
        updateFolder: scopesDashboardsService.updateFolder,
        changeSearchQuery: scopesDashboardsService.changeSearchQuery,
        clearSearchQuery: scopesDashboardsService.clearSearchQuery,
        toggleDrawer: scopesDashboardsService.toggleDrawer,
      }
    : undefined;
};
