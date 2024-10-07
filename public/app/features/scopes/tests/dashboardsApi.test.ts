import { config } from '@grafana/runtime';
import { setDashboardAPI } from 'app/features/dashboard/api/dashboard_api';

import { getDashboardDTO, updateScopes } from './utils/actions';
import { expectNewDashboardDTO, expectOldDashboardDTO } from './utils/assertions';
import { getDatasource, getInstanceSettings, getMock } from './utils/mocks';
import { renderDashboard, resetScenes } from './utils/render';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getBackendSrv: () => ({ get: getMock }),
  getDataSourceSrv: () => ({ get: getDatasource, getInstanceSettings }),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

const runTest = async (passScopes: boolean, kubernetesApi: boolean) => {
  config.featureToggles.scopeFilters = true;
  config.featureToggles.passScopeToDashboardApi = passScopes;
  config.featureToggles.kubernetesDashboards = kubernetesApi;
  setDashboardAPI(undefined);
  renderDashboard({}, { reloadOnScopesChange: true });
  await updateScopes(['grafana', 'mimir']);
  await getDashboardDTO();

  if (kubernetesApi) {
    return expectNewDashboardDTO();
  }

  if (passScopes) {
    return expectOldDashboardDTO(['grafana', 'mimir']);
  }

  return expectOldDashboardDTO();
};

describe('Dashboards API', () => {
  afterEach(async () => {
    setDashboardAPI(undefined);
    await resetScenes();
  });

  it('Legacy API should not pass the scopes with feature flag off', async () => runTest(false, false));
  it('K8s API should not pass the scopes with feature flag off', async () => runTest(false, true));
  it('Legacy API should pass the scopes with feature flag on', async () => runTest(true, false));
  it('K8s API should not pass the scopes with feature flag on', async () => runTest(true, true));
});
