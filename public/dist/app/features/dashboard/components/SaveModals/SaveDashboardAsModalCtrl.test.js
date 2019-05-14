import { SaveDashboardAsModalCtrl } from './SaveDashboardAsModalCtrl';
import { describe, it, expect } from 'test/lib/common';
describe('saving dashboard as', function () {
    function scenario(name, panel, verify) {
        describe(name, function () {
            var json = {
                title: 'name',
                panels: [panel],
            };
            var mockDashboardSrv = {
                getCurrent: function () {
                    return {
                        id: 5,
                        meta: {},
                        getSaveModelClone: function () {
                            return json;
                        },
                    };
                },
            };
            var ctrl = new SaveDashboardAsModalCtrl(mockDashboardSrv);
            var ctx = {
                clone: ctrl.clone,
                ctrl: ctrl,
                panel: panel,
            };
            it('verify', function () {
                verify(ctx);
            });
        });
    }
    scenario('default values', {}, function (ctx) {
        var clone = ctx.clone;
        expect(clone.id).toBe(null);
        expect(clone.title).toBe('name Copy');
        expect(clone.editable).toBe(true);
        expect(clone.hideControls).toBe(false);
    });
    var graphPanel = {
        id: 1,
        type: 'graph',
        alert: { rule: 1 },
        thresholds: { value: 3000 },
    };
    scenario('should remove alert from graph panel', graphPanel, function (ctx) {
        expect(ctx.panel.alert).toBe(undefined);
    });
    scenario('should remove threshold from graph panel', graphPanel, function (ctx) {
        expect(ctx.panel.thresholds).toBe(undefined);
    });
    scenario('singlestat should keep threshold', { id: 1, type: 'singlestat', thresholds: { value: 3000 } }, function (ctx) {
        expect(ctx.panel.thresholds).not.toBe(undefined);
    });
    scenario('table should keep threshold', { id: 1, type: 'table', thresholds: { value: 3000 } }, function (ctx) {
        expect(ctx.panel.thresholds).not.toBe(undefined);
    });
});
//# sourceMappingURL=SaveDashboardAsModalCtrl.test.js.map