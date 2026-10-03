import { createContext, type ReactNode, useMemo, useContext, useEffect } from 'react';

import { config, locationService, ScopesContext } from '@grafana/runtime';

import { ScopesApiClient } from './ScopesApiClient';
import { ScopesService } from './ScopesService';
import { ScopesDashboardsService } from './dashboards/ScopesDashboardsService';
import { ScopesSelectorService } from './selector/ScopesSelectorService';

type Services = {
  scopesService: ScopesService;
  scopesSelectorService: ScopesSelectorService;
  scopesDashboardsService: ScopesDashboardsService;
};

/**
 * We use this separate context to provide a private service to internal code, compared to the restricted public API
 * provided by the `ScopesContext`.
 */
const ScopesServicesContext = createContext<Services | undefined>(undefined);
export function useScopesServices() {
  return useContext(ScopesServicesContext);
}

interface ScopesContextProviderProps {
  children: ReactNode;
  services?: {
    scopesService: ScopesService;
    scopesSelectorService: ScopesSelectorService;
    scopesDashboardsService: ScopesDashboardsService;
  };
}

export function defaultScopesServices() {
  const client = new ScopesApiClient();
  const dashboardService = new ScopesDashboardsService(client);
  const selectorService = new ScopesSelectorService(client, dashboardService);
  const scopesService = new ScopesService(selectorService, dashboardService, locationService, client);

  // DEMO HACK — not meant to ship. Normally a dashboard's ScopesVariable (see
  // @grafana/scenes) enables scopes on mount and restores the prior state on
  // unmount, so the selector only shows up while viewing a dashboard. Forcing it
  // on here, once, at app boot, keeps it enabled everywhere instead — a
  // stack-wide filter rather than a dashboard-scoped one. Revert before this
  // goes anywhere near a real PR.
  scopesService.setEnabled(true);

  return {
    scopesService,
    scopesSelectorService: selectorService,
    scopesDashboardsService: dashboardService,
    client,
  };
}

export const ScopesContextProvider = ({ children, services }: ScopesContextProviderProps) => {
  const memoizedServices = useMemo(() => {
    return services ?? defaultScopesServices();
  }, [services]);

  useEffect(() => {
    return () => {
      memoizedServices.scopesService.cleanUp();
    };
  }, [memoizedServices]);

  return (
    <ScopesContext.Provider value={config.featureToggles.scopeFilters ? memoizedServices.scopesService : undefined}>
      <ScopesServicesContext.Provider value={config.featureToggles.scopeFilters ? memoizedServices : undefined}>
        {children}
      </ScopesServicesContext.Provider>
    </ScopesContext.Provider>
  );
};
