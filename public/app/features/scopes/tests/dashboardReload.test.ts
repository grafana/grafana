import { config } from '@grafana/runtime';
import { setDashboardAPI } from 'app/features/dashboard/api/dashboard_api';

import { enterEditMode, updateMyVar, updateScopes, updateTimeRange } from './utils/actions';
import { expectDashboardReload, expectNotDashboardReload } from './utils/assertions';
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

const runTest = async (
  reloadDashboardsOnParamsChange: boolean,
  reloadOnParamsChange: boolean,
  withUid: boolean,
  editMode: boolean
) => {
  config.featureToggles.reloadDashboardsOnParamsChange = reloadDashboardsOnParamsChange;
  setDashboardAPI(undefined);
  const uid = 'dash-1';
  const dashboardScene = renderDashboard({ uid: withUid ? uid : undefined }, { reloadOnParamsChange });

  if (editMode) {
    await enterEditMode(dashboardScene);
  }

  const shouldReload = reloadDashboardsOnParamsChange && reloadOnParamsChange && withUid && !editMode;

  await updateTimeRange(dashboardScene);
  if (!shouldReload) {
    expectNotDashboardReload();
  } else {
    expectDashboardReload();
  }

  await updateMyVar(dashboardScene, '2');
  if (!shouldReload) {
    expectNotDashboardReload();
  } else {
    expectDashboardReload();
  }

  await updateScopes(['grafana']);
  if (!shouldReload) {
    expectNotDashboardReload();
  } else {
    expectDashboardReload();
  }
};

describe('Dashboard reload', () => {
  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
  });

  afterEach(async () => {
    setDashboardAPI(undefined);
    await resetScenes();
  });

  describe('reloadDashboardsOnParamsChange off', () => {
    describe('reloadOnParamsChange off', () => {
      it('with UID - no reload', () => runTest(false, false, true, false));
      it('without UID - no reload', () => runTest(false, false, false, false));
    });

    describe('reloadOnParamsChange on', () => {
      it('with UID - no reload', () => runTest(false, true, true, false));
      it('without UID - no reload', () => runTest(false, true, false, false));
    });
  });

  describe('reloadDashboardsOnParamsChange on', () => {
    describe('reloadOnParamsChange off', () => {
      it('with UID - no reload', () => runTest(true, false, true, false));
      it('without UID - no reload', () => runTest(true, false, false, false));
    });

    describe('reloadOnParamsChange on', () => {
      describe('edit mode on', () => {
        it('with UID - no reload', () => runTest(true, true, true, true));
        it('without UID - no reload', () => runTest(true, true, false, true));
      });

      describe('edit mode off', () => {
        it('with UID - reload', () => runTest(true, true, true, false));
        it('without UID - no reload', () => runTest(true, true, false, false));
      });
    });
  });
});
