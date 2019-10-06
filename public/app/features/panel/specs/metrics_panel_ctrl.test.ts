jest.mock('app/core/core', () => ({}));
jest.mock('app/core/config', () => {
  return {
    bootData: {
      user: {},
    },
    panels: {
      test: {
        id: 'test',
        name: 'test',
      },
    },
    config: {
      appSubUrl: 'test',
    },
  };
});

// @ts-ignore
import q from 'q';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { MetricsPanelCtrl } from '../metrics_panel_ctrl';

describe('MetricsPanelCtrl', () => {
  describe('when getting additional menu items', () => {
    describe('and has no datasource set but user has access to explore', () => {
      it('should not return any items', async () => {
        const ctrl = setupController({ hasAccessToExplore: true });

        expect((await ctrl.getAdditionalMenuItems()).length).toBe(0);
      });
    });

    describe('and has datasource set that supports explore and user does not have access to explore', () => {
      it('should not return any items', async () => {
        const ctrl = setupController({ hasAccessToExplore: false });
        ctrl.datasource = { meta: { explore: true } } as any;

        expect((await ctrl.getAdditionalMenuItems()).length).toBe(0);
      });
    });

    describe('and has datasource set that supports explore and user has access to explore', () => {
      it('should return one item', async () => {
        const ctrl = setupController({ hasAccessToExplore: true });
        ctrl.datasource = { meta: { explore: true } } as any;

        expect((await ctrl.getAdditionalMenuItems()).length).toBe(1);
      });
    });
  });
});

function setupController({ hasAccessToExplore } = { hasAccessToExplore: false }) {
  const injectorStub = {
    get: (type: any) => {
      switch (type) {
        case '$q': {
          return q;
        }
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
  };

  MetricsPanelCtrl.prototype.panel = new PanelModel({ type: 'test' });

  return new MetricsPanelCtrl(scope, injectorStub);
}
