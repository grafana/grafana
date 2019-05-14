import { ChangeTracker } from './ChangeTracker';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardModel } from '../state/DashboardModel';
import { PanelModel } from '../state/PanelModel';
jest.mock('app/core/services/context_srv', function () { return ({
    contextSrv: {
        user: { orgId: 1 },
    },
}); });
describe('ChangeTracker', function () {
    var rootScope;
    var location;
    var timeout = function () { };
    var tracker;
    var dash;
    var scope;
    beforeEach(function () {
        dash = new DashboardModel({
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
        scope = {
            appEvent: jest.fn(),
            onAppEvent: jest.fn(),
            $on: jest.fn(),
        };
        rootScope = {
            appEvent: jest.fn(),
            onAppEvent: jest.fn(),
            $on: jest.fn(),
        };
        location = {
            path: jest.fn(),
        };
        tracker = new ChangeTracker(dash, scope, undefined, location, window, timeout, contextSrv, rootScope);
    });
    it('No changes should not have changes', function () {
        expect(tracker.hasChanges()).toBe(false);
    });
    it('Simple change should be registered', function () {
        dash.title = 'google';
        expect(tracker.hasChanges()).toBe(true);
    });
    it('Should ignore a lot of changes', function () {
        dash.time = { from: '1h' };
        dash.refresh = true;
        dash.schemaVersion = 10;
        expect(tracker.hasChanges()).toBe(false);
    });
    it('Should ignore .iteration changes', function () {
        dash.iteration = new Date().getTime() + 1;
        expect(tracker.hasChanges()).toBe(false);
    });
    it('Should ignore row collapse change', function () {
        dash.toggleRow(dash.panels[1]);
        expect(tracker.hasChanges()).toBe(false);
    });
    it('Should ignore panel legend changes', function () {
        dash.panels[0].legend.sortDesc = true;
        dash.panels[0].legend.sort = 'avg';
        expect(tracker.hasChanges()).toBe(false);
    });
    it('Should ignore panel repeats', function () {
        dash.panels.push(new PanelModel({ repeatPanelId: 10 }));
        expect(tracker.hasChanges()).toBe(false);
    });
});
//# sourceMappingURL=ChangeTracker.test.js.map