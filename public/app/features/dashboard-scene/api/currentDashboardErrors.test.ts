import { getCurrentDashboardErrors } from './currentDashboardErrors';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    featureToggles: {
      kubernetesDashboards: true,
      kubernetesDashboardsV2: true,
      dashboardNewLayouts: false,
    },
  },
}));

jest.mock('../pages/DashboardScenePageStateManager', () => ({
  getDashboardScenePageStateManager: jest.fn(),
}));

jest.mock('../utils/dashboardSceneGraph', () => ({
  dashboardSceneGraph: {
    getVizPanels: jest.fn(),
  },
}));

jest.mock('../utils/utils', () => ({
  getPanelIdForVizPanel: jest.fn(),
  getQueryRunnerFor: jest.fn(),
}));

describe('getCurrentDashboardErrors', () => {
  const { getDashboardScenePageStateManager } = jest.requireMock('../pages/DashboardScenePageStateManager');
  const { dashboardSceneGraph } = jest.requireMock('../utils/dashboardSceneGraph');
  const { getPanelIdForVizPanel, getQueryRunnerFor } = jest.requireMock('../utils/utils');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty list when there are no query errors', () => {
    getDashboardScenePageStateManager.mockReturnValue({ state: { dashboard: {} } });
    dashboardSceneGraph.getVizPanels.mockReturnValue([{ state: { title: 'P1' } }]);
    getPanelIdForVizPanel.mockReturnValue(1);
    getQueryRunnerFor.mockReturnValue({ state: { data: { errors: [] } } });

    expect(getCurrentDashboardErrors()).toEqual([]);
  });

  it('returns per-panel error summaries with refId and datasource when available', () => {
    const panel = { state: { title: 'My panel' } };
    getDashboardScenePageStateManager.mockReturnValue({ state: { dashboard: {} } });
    dashboardSceneGraph.getVizPanels.mockReturnValue([panel]);
    getPanelIdForVizPanel.mockReturnValue(42);
    getQueryRunnerFor.mockReturnValue({
      state: {
        datasource: { uid: 'fallback-ds' },
        queries: [{ refId: 'A', datasource: { name: 'gdev-mysql' } }],
        data: { errors: [{ message: 'boom', refId: 'A' }] },
      },
    });

    expect(getCurrentDashboardErrors()).toEqual([
      {
        panelId: 42,
        panelTitle: 'My panel',
        refId: 'A',
        datasource: 'gdev-mysql',
        message: 'boom',
        severity: 'error',
      },
    ]);
  });
});


