import { __assign } from "tslib";
import { DashboardModel } from '../../state/DashboardModel';
import { PanelModel } from '../../state/PanelModel';
import { setContextSrv } from '../../../../core/services/context_srv';
import { hasChanges, ignoreChanges } from './DashboardPrompt';
function getDefaultDashboardModel() {
    return new DashboardModel({
        refresh: false,
        panels: [
            {
                id: 1,
                type: 'graph',
                gridPos: { x: 0, y: 0, w: 24, h: 6 },
                legend: { sortDesc: false },
            },
            {
                id: 2,
                type: 'row',
                gridPos: { x: 0, y: 6, w: 24, h: 2 },
                collapsed: true,
                panels: [
                    { id: 3, type: 'graph', gridPos: { x: 0, y: 6, w: 12, h: 2 } },
                    { id: 4, type: 'graph', gridPos: { x: 12, y: 6, w: 12, h: 2 } },
                ],
            },
            { id: 5, type: 'row', gridPos: { x: 0, y: 6, w: 1, h: 1 } },
        ],
    });
}
function getTestContext() {
    var contextSrv = { isSignedIn: true, isEditor: true };
    setContextSrv(contextSrv);
    var dash = getDefaultDashboardModel();
    var original = dash.getSaveModelClone();
    return { dash: dash, original: original, contextSrv: contextSrv };
}
describe('DashboardPrompt', function () {
    it('No changes should not have changes', function () {
        var _a = getTestContext(), original = _a.original, dash = _a.dash;
        expect(hasChanges(dash, original)).toBe(false);
    });
    it('Simple change should be registered', function () {
        var _a = getTestContext(), original = _a.original, dash = _a.dash;
        dash.title = 'google';
        expect(hasChanges(dash, original)).toBe(true);
    });
    it('Should ignore a lot of changes', function () {
        var _a = getTestContext(), original = _a.original, dash = _a.dash;
        dash.time = { from: '1h' };
        dash.refresh = true;
        dash.schemaVersion = 10;
        expect(hasChanges(dash, original)).toBe(false);
    });
    it('Should ignore .iteration changes', function () {
        var _a = getTestContext(), original = _a.original, dash = _a.dash;
        dash.iteration = new Date().getTime() + 1;
        expect(hasChanges(dash, original)).toBe(false);
    });
    it('Should ignore row collapse change', function () {
        var _a = getTestContext(), original = _a.original, dash = _a.dash;
        dash.toggleRow(dash.panels[1]);
        expect(hasChanges(dash, original)).toBe(false);
    });
    it('Should ignore panel legend changes', function () {
        var _a = getTestContext(), original = _a.original, dash = _a.dash;
        dash.panels[0].legend.sortDesc = true;
        dash.panels[0].legend.sort = 'avg';
        expect(hasChanges(dash, original)).toBe(false);
    });
    it('Should ignore panel repeats', function () {
        var _a = getTestContext(), original = _a.original, dash = _a.dash;
        dash.panels.push(new PanelModel({ repeatPanelId: 10 }));
        expect(hasChanges(dash, original)).toBe(false);
    });
    describe('ignoreChanges', function () {
        describe('when called without original dashboard', function () {
            it('then it should return true', function () {
                var dash = getTestContext().dash;
                expect(ignoreChanges(dash, null)).toBe(true);
            });
        });
        describe('when called without current dashboard', function () {
            it('then it should return true', function () {
                var original = getTestContext().original;
                expect(ignoreChanges(null, original)).toBe(true);
            });
        });
        describe('when called without meta in current dashboard', function () {
            it('then it should return true', function () {
                var _a = getTestContext(), original = _a.original, dash = _a.dash;
                expect(ignoreChanges(__assign(__assign({}, dash), { meta: undefined }), original)).toBe(true);
            });
        });
        describe('when called for a viewer without save permissions', function () {
            it('then it should return true', function () {
                var _a = getTestContext(), original = _a.original, dash = _a.dash, contextSrv = _a.contextSrv;
                contextSrv.isEditor = false;
                expect(ignoreChanges(__assign(__assign({}, dash), { meta: { canSave: false } }), original)).toBe(true);
            });
        });
        describe('when called for a viewer with save permissions', function () {
            it('then it should return undefined', function () {
                var _a = getTestContext(), original = _a.original, dash = _a.dash, contextSrv = _a.contextSrv;
                contextSrv.isEditor = false;
                expect(ignoreChanges(__assign(__assign({}, dash), { meta: { canSave: true } }), original)).toBe(undefined);
            });
        });
        describe('when called for an user that is not signed in', function () {
            it('then it should return true', function () {
                var _a = getTestContext(), original = _a.original, dash = _a.dash, contextSrv = _a.contextSrv;
                contextSrv.isSignedIn = false;
                expect(ignoreChanges(__assign(__assign({}, dash), { meta: { canSave: true } }), original)).toBe(true);
            });
        });
        describe('when called with fromScript', function () {
            it('then it should return true', function () {
                var _a = getTestContext(), original = _a.original, dash = _a.dash;
                expect(ignoreChanges(__assign(__assign({}, dash), { meta: { canSave: true, fromScript: true, fromFile: undefined } }), original)).toBe(true);
            });
        });
        describe('when called with fromFile', function () {
            it('then it should return true', function () {
                var _a = getTestContext(), original = _a.original, dash = _a.dash;
                expect(ignoreChanges(__assign(__assign({}, dash), { meta: { canSave: true, fromScript: undefined, fromFile: true } }), original)).toBe(true);
            });
        });
        describe('when called with canSave but without fromScript and fromFile', function () {
            it('then it should return false', function () {
                var _a = getTestContext(), original = _a.original, dash = _a.dash;
                expect(ignoreChanges(__assign(__assign({}, dash), { meta: { canSave: true, fromScript: undefined, fromFile: undefined } }), original)).toBe(undefined);
            });
        });
    });
});
//# sourceMappingURL=DashboardPrompt.test.js.map