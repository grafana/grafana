import { waitFor } from '@testing-library/dom';

import { config, locationService, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_DEFAULT_SCOPE, setTestFlags } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import { type ScopesService } from '../ScopesService';
import { type ScopesSelectorService } from '../selector/ScopesSelectorService';

import { getDatasource, getInstanceSettings } from './utils/mocks';
import { renderDashboard, resetScenes } from './utils/render';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getDataSourceSrv: () => ({ get: getDatasource, getInstanceSettings }),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

setBackendSrv(backendSrv);
setupMockServer();

describe('Default scope', () => {
  let scopesService: ScopesService;
  let scopesSelectorService: ScopesSelectorService;

  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
  });

  beforeEach(() => {
    setTestFlags({
      'grafana.enableScopesFirstMode': true,
      'grafana.useDefaultScopesEndpoint': true,
    });
    window.localStorage.clear();
  });

  afterEach(async () => {
    setTestFlags({});
    locationService.replace('');
    window.localStorage.clear();
    await resetScenes();
  });

  it('applies the default scope and pre-fetches its defaultPath nodes on first mount', async () => {
    ({ scopesService, scopesSelectorService } = await renderDashboard());

    const expectedName = MOCK_DEFAULT_SCOPE.metadata.name;
    const expectedPath = MOCK_DEFAULT_SCOPE.spec.defaultPath ?? [];
    expect(expectedPath.length).toBeGreaterThan(0);

    // The default scope is applied via the find/default_scope handler.
    await waitFor(() => {
      expect(scopesSelectorService.state.appliedScopes).toEqual([expect.objectContaining({ scopeId: expectedName })]);
    });

    // Its metadata reaches selector state (via the seeded getScope cache).
    expect(scopesSelectorService.state.scopes[expectedName]).toBeDefined();
    expect(scopesSelectorService.state.scopes[expectedName].spec.defaultPath).toEqual(expectedPath);

    // And every node in defaultPath has been pre-fetched into state.nodes,
    // so opening the selector can expand the tree immediately to the leaf.
    for (const nodeId of expectedPath) {
      expect(scopesSelectorService.state.nodes[nodeId]).toBeDefined();
    }

    // scopeNodeId is backfilled from defaultPath's last element.
    expect(scopesSelectorService.state.appliedScopes[0].scopeNodeId).toBe(expectedPath[expectedPath.length - 1]);

    // And the public ScopesContextValue exposes the applied scope (filter
    // through to scenes/variable consumers).
    await waitFor(() => {
      expect(scopesService.state.value).toEqual([expect.objectContaining({ metadata: { name: expectedName } })]);
    });
  });

  it('does not fetch the default scope when grafana.enableScopesFirstMode is off', async () => {
    setTestFlags({
      'grafana.enableScopesFirstMode': false,
      'grafana.useDefaultScopesEndpoint': true,
    });

    ({ scopesSelectorService } = await renderDashboard());

    // Give the dashboard a tick to settle.
    await waitFor(() => {
      expect(scopesSelectorService.state.tree).toBeDefined();
    });

    expect(scopesSelectorService.state.appliedScopes).toEqual([]);
  });

  it('does not fetch the default scope when grafana.useDefaultScopesEndpoint is off', async () => {
    setTestFlags({
      'grafana.enableScopesFirstMode': true,
      'grafana.useDefaultScopesEndpoint': false,
    });

    ({ scopesSelectorService } = await renderDashboard());

    await waitFor(() => {
      expect(scopesSelectorService.state.tree).toBeDefined();
    });

    expect(scopesSelectorService.state.appliedScopes).toEqual([]);
  });
});
