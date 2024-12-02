import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { getScopesDashboardsService } from './services';

export const useScopesDashboardsService = () => {
  const scopesDashboardsService = getScopesDashboardsService();

  useObservable(scopesDashboardsService?.stateObservable ?? new Observable(), scopesDashboardsService?.state);

  if (!scopesDashboardsService) {
    return undefined;
  }

  return scopesDashboardsService;
};
