jest.mock('app/core/core', () => ({}));
jest.mock('app/core/config', () => {
  return {
    exploreEnabled: true,
    panels: {
      test: {
        id: 'test',
        name: 'test',
      },
    },
  };
});

import q from 'q';
import { PanelModel } from 'app/features/dashboard/panel_model';
import { MetricsPanelCtrl } from '../metrics_panel_ctrl';

describe('MetricsPanelCtrl', () => {
  let ctrl;

  beforeEach(() => {
    ctrl = setupController();
  });

  describe('when getting additional menu items', () => {
    let additionalItems;

    describe('and has no datasource set', () => {
      beforeEach(() => {
        additionalItems = ctrl.getAdditionalMenuItems();
      });

      it('should not return any items', () => {
        expect(additionalItems.length).toBe(0);
      });
    });

    describe('and has datasource set that supports explore and user has powers', () => {
      beforeEach(() => {
        ctrl.contextSrv = { isEditor: true };
        ctrl.datasource = { supportsExplore: true };
        additionalItems = ctrl.getAdditionalMenuItems();
      });

      it('should not return any items', () => {
        expect(additionalItems.length).toBe(1);
      });
    });
  });
});

function setupController() {
  const injectorStub = {
    get: type => {
      switch (type) {
        case '$q': {
          return q;
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
