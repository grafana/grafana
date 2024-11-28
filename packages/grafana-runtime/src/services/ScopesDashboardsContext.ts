import { createContext, useContext, useMemo } from 'react';
import { useObservable } from 'react-use';

import { ScopesDashboardsService, ScopesDashboardsServiceState } from './ScopesDashboardsService';
import { getScopesDashboardsService } from './scopes';

export const ScopesDashboardsContext = createContext<ScopesDashboardsService>(getScopesDashboardsService());

export function useScopesDashboards() {
  const context = useContext(ScopesDashboardsContext);
  const state: ScopesDashboardsServiceState | undefined = useObservable(context.stateObservable, context.state);

  return useMemo(() => {
    return {
      state,
      changeSearchQuery: context.changeSearchQuery.bind(context),
      clearSearchQuery: context.clearSearchQuery.bind(context),
      togglePanel: context.togglePanel.bind(context),
      updateFolder: context.updateFolder.bind(context),
    };
  }, [context, state]);
}
