jest.mock('app/core/core', () => ({}));
jest.mock('app/core/config', () => {
  return {
    ...jest.requireActual('app/core/config'),
    panels: {
      test: {
        id: 'test',
        name: 'test',
      },
    },
  };
});

import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { MetricsPanelCtrl } from '../metrics_panel_ctrl';

describe('MetricsPanelCtrl', () => {
  describe('can setup', () => {
    it('should return controller', async () => {
      const ctrl = setupController({ hasAccessToExplore: true });
      expect((await ctrl.getAdditionalMenuItems()).length).toBe(0);
    });
  });
});

function setupController({ hasAccessToExplore } = { hasAccessToExplore: false }) {
  const injectorStub = {
    get: (type: any) => {
      switch (type) {
        case 'contextSrv': {
          return { hasAccessToExplore: () => hasAccessToExplore };
        }
        case 'timeSrv': {
          return { timeRangeForUrl: () => {} };
        }
        default: {
          return jest.fn();
        }
      }
    },
  };

  const scope: any = {
    panel: { events: [] },
    appEvent: jest.fn(),
    onAppEvent: jest.fn(),
    $on: jest.fn(),
    colors: [],
    $parent: {
      panel: new PanelModel({ type: 'test' }),
      dashboard: {},
    },
  };

  return new MetricsPanelCtrl(scope, injectorStub);
}
