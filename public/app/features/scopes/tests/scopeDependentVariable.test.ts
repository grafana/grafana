import { config, locationService, setBackendSrv } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { type DashboardScene } from '../../dashboard-scene/scene/DashboardScene';
import { type ScopesService } from '../ScopesService';

import {
  applyScopes,
  clearSelector,
  expandResultApplications,
  hoverSelector,
  openSelector,
  selectResultApplicationsGrafana,
} from './utils/actions';
import { getDatasource, getInstanceSettings } from './utils/mocks';
import { renderDashboard, resetScenes } from './utils/render';
import { getListOfScopes } from './utils/selectors';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getDataSourceSrv: () => ({ get: getDatasource, getInstanceSettings }),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

setBackendSrv(backendSrv);
setupMockServer();

// A custom variable whose options are derived from the selected scopes, which is the
// configuration reported in hyperion-planning#666.
const SCOPE_DEPENDENT_VARIABLE = {
  templating: {
    list: [
      {
        current: { text: '', value: '' },
        name: 'scope_var',
        options: [],
        query: '${__scopes}',
        type: 'custom' as const,
      },
    ],
  },
};

function getVariableValue(scene: DashboardScene) {
  return sceneGraph.lookupVariable('scope_var', scene)?.getValue();
}

describe('Scope-dependent custom variable', () => {
  let scopesService: ScopesService;
  let scene: DashboardScene;

  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
  });

  beforeEach(async () => {
    const result = await renderDashboard(SCOPE_DEPENDENT_VARIABLE);
    scopesService = result.scopesService;
    scene = result.scene;
    window.localStorage.clear();
  });

  afterEach(async () => {
    locationService.replace('');
    window.localStorage.clear();
    await resetScenes();
  });

  it('resets when all scopes are removed, without the removal being undone', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsGrafana();
    await applyScopes();
    await jest.runOnlyPendingTimersAsync();

    const appliedScopes = getListOfScopes(scopesService);
    expect(appliedScopes).toHaveLength(1);
    const scopeName = appliedScopes[0].metadata.name;

    // The variable follows the selected scope. This part already worked.
    expect(getVariableValue(scene)).toBe(scopeName);

    await hoverSelector();
    await clearSelector();
    await jest.runOnlyPendingTimersAsync();

    // Both halves matter. Resetting the variable synchronously writes var-scope_var while
    // the stale scopes param is still in the URL, and ScopesService's URL listener then
    // re-applies the scope that was just removed — so asserting only the variable would
    // pass while scope removal was silently broken.
    expect(getListOfScopes(scopesService)).toHaveLength(0);
    expect(locationService.getSearchObject().scopes).toBeUndefined();
    expect(getVariableValue(scene)).toBe('');
  });
});
