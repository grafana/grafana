import { getPanelPlugin } from '@grafana/data/test';
import { reportInteraction, setPluginImportUtils } from '@grafana/runtime';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import nestedDashboard from '../serialization/testfiles/nested_dashboard.json';
import { getTestDashboardSceneFromSaveModel } from '../utils/test-utils';

import { trackDashboardSceneCreatedOrSaved } from './tracking';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    featureToggles: {
      dashboardNewLayouts: true,
    },
  },
}));

// mock useSaveDashboardMutation
jest.mock('app/features/browse-dashboards/api/browseDashboardsAPI', () => ({
  useSaveDashboardMutation: () => [() => Promise.resolve({ data: { version: 2, uid: 'new-uid' } })],
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

export function buildTestScene() {
  const dashboard = getTestDashboardSceneFromSaveModel(nestedDashboard as Partial<DashboardV2Spec>);
  return dashboard;
}

describe('dashboard tracking', () => {
  describe('save v2 dashboard tracking', () => {
    it('should call report interaction with correct parameters when saving a new dashboard', async () => {
      const scene = buildTestScene();
      trackDashboardSceneCreatedOrSaved('created', scene, { name: 'new dashboard', url: 'new-uid' });
      expect(reportInteraction).toHaveBeenCalledWith('dashboards_created', {
        isDynamicDashboard: true,
        name: 'new dashboard',
        url: 'new-uid',
        numPanels: 6,
        conditionalRenderRules: 3,
        autoLayout: 3,
        customGridLayout: 2,
      });
    });
  });
});
