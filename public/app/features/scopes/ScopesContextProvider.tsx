import { createContext, ReactNode, useMemo, useContext, useEffect } from 'react';

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
export const ScopesServicesContext = createContext<Services | undefined>(undefined);
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
  return {
    scopesService: new ScopesService(selectorService, dashboardService, locationService),
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
