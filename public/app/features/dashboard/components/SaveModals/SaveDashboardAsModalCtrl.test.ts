import { SaveDashboardAsModalCtrl } from './SaveDashboardAsModalCtrl';
import { describe, it, expect } from 'test/lib/common';

describe('saving dashboard as', () => {
  function scenario(name: string, panel: any, verify: Function) {
    describe(name, () => {
      const json = {
        title: 'name',
        panels: [panel],
      };

      const mockDashboardSrv: any = {
        getCurrent: () => {
          return {
            id: 5,
            meta: {},
            getSaveModelClone: () => {
              return json;
            },
          };
        },
      };

      const ctrl = new SaveDashboardAsModalCtrl(mockDashboardSrv);
      const ctx: any = {
        clone: ctrl.clone,
        ctrl: ctrl,
        panel: panel,
      };

      it('verify', () => {
        verify(ctx);
      });
    });
  }

  scenario('default values', {}, (ctx: any) => {
    const clone = ctx.clone;
    expect(clone.id).toBe(null);
    expect(clone.title).toBe('name Copy');
    expect(clone.editable).toBe(true);
    expect(clone.hideControls).toBe(false);
  });

  const graphPanel = {
    id: 1,
    type: 'graph',
    alert: { rule: 1 },
    thresholds: { value: 3000 },
  };

  scenario('should remove alert from graph panel', graphPanel, (ctx: any) => {
    expect(ctx.panel.alert).toBe(undefined);
  });

  scenario('should remove threshold from graph panel', graphPanel, (ctx: any) => {
    expect(ctx.panel.thresholds).toBe(undefined);
  });

  scenario(
    'singlestat should keep threshold',
    { id: 1, type: 'singlestat', thresholds: { value: 3000 } },
    (ctx: any) => {
      expect(ctx.panel.thresholds).not.toBe(undefined);
    }
  );

  scenario('table should keep threshold', { id: 1, type: 'table', thresholds: { value: 3000 } }, (ctx: any) => {
    expect(ctx.panel.thresholds).not.toBe(undefined);
  });
});
