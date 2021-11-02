import { DashboardModel } from '../state/DashboardModel';
describe('Merge dashbaord panels', function () {
    describe('simple changes', function () {
        var dashboard;
        var rawPanels;
        beforeEach(function () {
            dashboard = new DashboardModel({
                title: 'simple title',
                panels: [
                    {
                        id: 1,
                        type: 'timeseries',
                    },
                    {
                        id: 2,
                        type: 'timeseries',
                    },
                    {
                        id: 3,
                        type: 'table',
                        fieldConfig: {
                            defaults: {
                                thresholds: {
                                    mode: 'absolute',
                                    steps: [
                                        { color: 'green', value: -Infinity },
                                        { color: 'red', value: 80 },
                                    ],
                                },
                                mappings: [],
                                color: { mode: 'thresholds' },
                            },
                            overrides: [],
                        },
                    },
                ],
            });
            rawPanels = dashboard.getSaveModelClone().panels;
        });
        it('should load and support noop', function () {
            expect(dashboard.title).toBe('simple title');
            expect(dashboard.panels.length).toEqual(rawPanels.length);
            var info = dashboard.updatePanels(rawPanels);
            expect(info.changed).toBeFalsy();
            expect(info.actions).toMatchInlineSnapshot("\n        Object {\n          \"add\": Array [],\n          \"noop\": Array [\n            1,\n            2,\n            3,\n          ],\n          \"remove\": Array [],\n          \"replace\": Array [],\n          \"update\": Array [],\n        }\n      ");
        });
        it('should identify an add', function () {
            rawPanels.push({
                id: 7,
                type: 'canvas',
            });
            var info = dashboard.updatePanels(rawPanels);
            expect(info.changed).toBeTruthy();
            expect(info.actions['add']).toEqual([7]);
        });
        it('should identify a remove', function () {
            rawPanels.shift();
            var info = dashboard.updatePanels(rawPanels);
            expect(info.changed).toBeTruthy();
            expect(info.actions['remove']).toEqual([1]);
        });
        it('should allow change in key order for nested elements', function () {
            rawPanels[2].fieldConfig = {
                defaults: {
                    color: { mode: 'thresholds' },
                    mappings: [],
                    thresholds: {
                        steps: [
                            { color: 'green', value: null },
                            { color: 'red', value: 80 },
                        ],
                        mode: 'absolute',
                    },
                },
                overrides: [],
            };
            // Same config, different order
            var js0 = JSON.stringify(dashboard.panels[2].fieldConfig);
            var js1 = JSON.stringify(rawPanels[2].fieldConfig);
            expect(js1).not.toEqual(js0);
            expect(js1.length).toEqual(js0.length);
            // no real changes here
            var info = dashboard.updatePanels(rawPanels);
            expect(info.changed).toBeFalsy();
        });
        it('should replace a type change', function () {
            rawPanels[1].type = 'canvas';
            var info = dashboard.updatePanels(rawPanels);
            expect(info.changed).toBeTruthy();
            expect(info.actions).toMatchInlineSnapshot("\n        Object {\n          \"add\": Array [],\n          \"noop\": Array [\n            1,\n            3,\n          ],\n          \"remove\": Array [],\n          \"replace\": Array [\n            2,\n          ],\n          \"update\": Array [],\n        }\n      ");
        });
    });
});
//# sourceMappingURL=panelMerge.test.js.map