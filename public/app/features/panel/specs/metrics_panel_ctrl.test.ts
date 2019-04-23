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
  };
});

import q from 'q';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { MetricsPanelCtrl } from '../metrics_panel_ctrl';

describe('MetricsPanelCtrl', () => {
  describe('when getting additional menu items', () => {
    describe('and has no datasource set but user has access to explore', () => {
      it('should not return any items', () => {
        const ctrl = setupController({ hasAccessToExplore: true });

        expect(ctrl.getAdditionalMenuItems().length).toBe(0);
      });
    });

    describe('and has datasource set that supports explore and user does not have access to explore', () => {
      it('should not return any items', () => {
        const ctrl = setupController({ hasAccessToExplore: false });
        ctrl.datasource = { meta: { explore: true } } as any;

        expect(ctrl.getAdditionalMenuItems().length).toBe(0);
      });
    });

    describe('and has datasource set that supports explore and user has access to explore', () => {
      it('should return one item', () => {
        const ctrl = setupController({ hasAccessToExplore: true });
        ctrl.datasource = { meta: { explore: true } } as any;

        expect(ctrl.getAdditionalMenuItems().length).toBe(1);
      });
    });
  });
});

function setupController({ hasAccessToExplore } = { hasAccessToExplore: false }) {
  const injectorStub = {
    get: type => {
      switch (type) {
        case '$q': {
          return q;
        }
        case 'contextSrv': {
          return { hasAccessToExplore: () => hasAccessToExplore };
        }
        default: {
          return jest.fn();
        }
      }
    },
  };

  const scope = {
    panel: { events: [] },
    appEvent: jest.fn(),
    onAppEvent: jest.fn(),
    $on: jest.fn(),
    colors: [],
  };

  MetricsPanelCtrl.prototype.panel = new PanelModel({ type: 'test' });

  return new MetricsPanelCtrl(scope, injectorStub);
}
