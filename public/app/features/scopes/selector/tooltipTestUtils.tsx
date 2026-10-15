import { type ReactElement } from 'react';
import { render } from 'test/test-utils';

import { type Scope, type ScopeNode } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { ScopesApiClient } from '../ScopesApiClient';
import { ScopesContextProvider } from '../ScopesContextProvider';
import { ScopesService } from '../ScopesService';
import { ScopesDashboardsService } from '../dashboards/ScopesDashboardsService';

import { ScopesSelectorService } from './ScopesSelectorService';

interface Fixtures {
  scopes?: Scope[];
  nodes?: ScopeNode[];
}

/**
 * Renders with the real scopes services. Callers must enable the `scopeFilters` toggle with `testWithFeatureToggles`. Only the API client, the network boundary, is stubbed with the given
 * scopes and nodes.
 */
export function renderWithScopesServices(ui: ReactElement, { scopes = [], nodes = [] }: Fixtures = {}) {
  const client = new ScopesApiClient();
  const fetchScope = jest
    .spyOn(client, 'fetchScope')
    .mockImplementation(async (name) => scopes.find((s) => s.metadata.name === name));
  jest.spyOn(client, 'fetchScopeNode').mockImplementation(async (name) => nodes.find((n) => n.metadata.name === name));

  const dashboardsService = new ScopesDashboardsService(client);
  const scopesSelectorService = new ScopesSelectorService(client, dashboardsService);
  const services = {
    scopesService: new ScopesService(scopesSelectorService, dashboardsService, locationService, client),
    scopesSelectorService,
    scopesDashboardsService: dashboardsService,
  };

  const result = render(<ScopesContextProvider services={services}>{ui}</ScopesContextProvider>);

  return {
    ...result,
    fetchScope,
    scopesSelectorService,
  };
}
