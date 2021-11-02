import { compact, flattenDeep, map, uniq } from 'lodash';
import { expect } from 'test/lib/common';
import { getDashboardModel } from '../../../../test/helpers/getDashboardModel';
import { PanelModel } from './PanelModel';
jest.mock('app/core/services/context_srv', function () { return ({}); });
describe('given dashboard with panel repeat', function () {
    var dashboard;
    beforeEach(function () {
        var dashboardJSON = {
            panels: [
                { id: 1, type: 'row', gridPos: { x: 0, y: 0, h: 1, w: 24 } },
                { id: 2, repeat: 'apps', repeatDirection: 'h', gridPos: { x: 0, y: 1, h: 2, w: 8 } },
            ],
            templating: {
                list: [
                    {
                        name: 'apps',
                        type: 'custom',
                        current: {
                            text: 'se1, se2, se3',
                            value: ['se1', 'se2', 'se3'],
                        },
                        options: [
                            { text: 'se1', value: 'se1', selected: true },
                            { text: 'se2', value: 'se2', selected: true },
                            { text: 'se3', value: 'se3', selected: true },
                            { text: 'se4', value: 'se4', selected: false },
                        ],
                    },
                ],
            },
        };
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats();
    });
    it('should repeat panels when row is expanding', function () {
        expect(dashboard.panels.length).toBe(4);
        // toggle row
        dashboard.toggleRow(dashboard.panels[0]);
        expect(dashboard.panels.length).toBe(1);
        // change variable
        dashboard.templating.list[0].options[2].selected = false;
        dashboard.templating.list[0].current = {
            text: 'se1, se2',
            value: ['se1', 'se2'],
        };
        // toggle row back
        dashboard.toggleRow(dashboard.panels[0]);
        expect(dashboard.panels.length).toBe(3);
    });
});
describe('given dashboard with panel repeat in horizontal direction', function () {
    var dashboard;
    beforeEach(function () {
        var dashboardJSON = {
            panels: [
                {
                    id: 2,
                    repeat: 'apps',
                    repeatDirection: 'h',
                    gridPos: { x: 0, y: 0, h: 2, w: 24 },
                },
            ],
            templating: {
                list: [
                    {
                        name: 'apps',
                        type: 'custom',
                        current: {
                            text: 'se1, se2, se3',
                            value: ['se1', 'se2', 'se3'],
                        },
                        options: [
                            { text: 'se1', value: 'se1', selected: true },
                            { text: 'se2', value: 'se2', selected: true },
                            { text: 'se3', value: 'se3', selected: true },
                            { text: 'se4', value: 'se4', selected: false },
                        ],
                    },
                ],
            },
        };
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats();
    });
    it('should repeat panel 3 times', function () {
        expect(dashboard.panels.length).toBe(3);
    });
    it('should mark panel repeated', function () {
        expect(dashboard.panels[0].repeat).toBe('apps');
        expect(dashboard.panels[1].repeatPanelId).toBe(2);
    });
    it('should set scopedVars on panels', function () {
        expect(dashboard.panels[0].scopedVars.apps.value).toBe('se1');
        expect(dashboard.panels[1].scopedVars.apps.value).toBe('se2');
        expect(dashboard.panels[2].scopedVars.apps.value).toBe('se3');
    });
    it('should place on first row and adjust width so all fit', function () {
        expect(dashboard.panels[0].gridPos).toMatchObject({
            x: 0,
            y: 0,
            h: 2,
            w: 8,
        });
        expect(dashboard.panels[1].gridPos).toMatchObject({
            x: 8,
            y: 0,
            h: 2,
            w: 8,
        });
        expect(dashboard.panels[2].gridPos).toMatchObject({
            x: 16,
            y: 0,
            h: 2,
            w: 8,
        });
    });
    describe('After a second iteration', function () {
        beforeEach(function () {
            dashboard.panels[0].fill = 10;
            dashboard.processRepeats();
        });
        it('reused panel should copy properties from source', function () {
            expect(dashboard.panels[1].fill).toBe(10);
        });
        it('should have same panel count', function () {
            expect(dashboard.panels.length).toBe(3);
        });
    });
    describe('After a second iteration with different variable', function () {
        beforeEach(function () {
            dashboard.templating.list.push({
                name: 'server',
                current: { text: 'se1, se2, se3', value: ['se1'] },
                options: [{ text: 'se1', value: 'se1', selected: true }],
            });
            dashboard.panels[0].repeat = 'server';
            dashboard.processRepeats();
        });
        it('should remove scopedVars value for last variable', function () {
            expect(dashboard.panels[0].scopedVars.apps).toBe(undefined);
        });
        it('should have new variable value in scopedVars', function () {
            expect(dashboard.panels[0].scopedVars.server.value).toBe('se1');
        });
    });
    describe('After a second iteration and selected values reduced', function () {
        beforeEach(function () {
            dashboard.templating.list[0].options[1].selected = false;
            dashboard.processRepeats();
        });
        it('should clean up repeated panel', function () {
            expect(dashboard.panels.length).toBe(2);
        });
    });
    describe('After a second iteration and panel repeat is turned off', function () {
        beforeEach(function () {
            dashboard.panels[0].repeat = null;
            dashboard.processRepeats();
        });
        it('should clean up repeated panel', function () {
            expect(dashboard.panels.length).toBe(1);
        });
        it('should remove scoped vars from reused panel', function () {
            expect(dashboard.panels[0].scopedVars).toBe(undefined);
        });
    });
});
describe('given dashboard with panel repeat in vertical direction', function () {
    var dashboard;
    beforeEach(function () {
        var dashboardJSON = {
            panels: [
                { id: 1, type: 'row', gridPos: { x: 0, y: 0, h: 1, w: 24 } },
                { id: 2, repeat: 'apps', repeatDirection: 'v', gridPos: { x: 5, y: 1, h: 2, w: 8 } },
                { id: 3, type: 'row', gridPos: { x: 0, y: 3, h: 1, w: 24 } },
            ],
            templating: {
                list: [
                    {
                        name: 'apps',
                        type: 'custom',
                        current: {
                            text: 'se1, se2, se3',
                            value: ['se1', 'se2', 'se3'],
                        },
                        options: [
                            { text: 'se1', value: 'se1', selected: true },
                            { text: 'se2', value: 'se2', selected: true },
                            { text: 'se3', value: 'se3', selected: true },
                            { text: 'se4', value: 'se4', selected: false },
                        ],
                    },
                ],
            },
        };
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats();
    });
    it('should place on items on top of each other and keep witdh', function () {
        expect(dashboard.panels[0].gridPos).toMatchObject({ x: 0, y: 0, h: 1, w: 24 }); // first row
        expect(dashboard.panels[1].gridPos).toMatchObject({ x: 5, y: 1, h: 2, w: 8 });
        expect(dashboard.panels[2].gridPos).toMatchObject({ x: 5, y: 3, h: 2, w: 8 });
        expect(dashboard.panels[3].gridPos).toMatchObject({ x: 5, y: 5, h: 2, w: 8 });
        expect(dashboard.panels[4].gridPos).toMatchObject({ x: 0, y: 7, h: 1, w: 24 }); // last row
    });
});
describe('given dashboard with row repeat and panel repeat in horizontal direction', function () {
    var dashboard, dashboardJSON;
    beforeEach(function () {
        dashboardJSON = {
            panels: [
                { id: 1, type: 'row', repeat: 'region', gridPos: { x: 0, y: 0, h: 1, w: 24 } },
                { id: 2, type: 'graph', repeat: 'app', gridPos: { x: 0, y: 1, h: 2, w: 6 } },
            ],
            templating: {
                list: [
                    {
                        name: 'region',
                        type: 'custom',
                        current: {
                            text: 'reg1, reg2',
                            value: ['reg1', 'reg2'],
                        },
                        options: [
                            { text: 'reg1', value: 'reg1', selected: true },
                            { text: 'reg2', value: 'reg2', selected: true },
                        ],
                    },
                    {
                        name: 'app',
                        type: 'custom',
                        current: {
                            text: 'se1, se2, se3, se4, se5, se6',
                            value: ['se1', 'se2', 'se3', 'se4', 'se5', 'se6'],
                        },
                        options: [
                            { text: 'se1', value: 'se1', selected: true },
                            { text: 'se2', value: 'se2', selected: true },
                            { text: 'se3', value: 'se3', selected: true },
                            { text: 'se4', value: 'se4', selected: true },
                            { text: 'se5', value: 'se5', selected: true },
                            { text: 'se6', value: 'se6', selected: true },
                        ],
                    },
                ],
            },
        };
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats(false);
    });
    it('should panels in self row', function () {
        var panelTypes = map(dashboard.panels, 'type');
        expect(panelTypes).toEqual([
            'row',
            'graph',
            'graph',
            'graph',
            'graph',
            'graph',
            'graph',
            'row',
            'graph',
            'graph',
            'graph',
            'graph',
            'graph',
            'graph',
        ]);
    });
    it('should be placed in their places', function () {
        expect(dashboard.panels[0].gridPos).toMatchObject({ x: 0, y: 0, h: 1, w: 24 }); // 1st row
        expect(dashboard.panels[1].gridPos).toMatchObject({ x: 0, y: 1, h: 2, w: 6 });
        expect(dashboard.panels[2].gridPos).toMatchObject({ x: 6, y: 1, h: 2, w: 6 });
        expect(dashboard.panels[3].gridPos).toMatchObject({ x: 12, y: 1, h: 2, w: 6 });
        expect(dashboard.panels[4].gridPos).toMatchObject({ x: 18, y: 1, h: 2, w: 6 });
        expect(dashboard.panels[5].gridPos).toMatchObject({ x: 0, y: 3, h: 2, w: 6 }); // next row
        expect(dashboard.panels[6].gridPos).toMatchObject({ x: 6, y: 3, h: 2, w: 6 });
        expect(dashboard.panels[7].gridPos).toMatchObject({ x: 0, y: 5, h: 1, w: 24 });
        expect(dashboard.panels[8].gridPos).toMatchObject({ x: 0, y: 6, h: 2, w: 6 }); // 2nd row
        expect(dashboard.panels[9].gridPos).toMatchObject({ x: 6, y: 6, h: 2, w: 6 });
        expect(dashboard.panels[10].gridPos).toMatchObject({ x: 12, y: 6, h: 2, w: 6 });
        expect(dashboard.panels[11].gridPos).toMatchObject({ x: 18, y: 6, h: 2, w: 6 }); // next row
        expect(dashboard.panels[12].gridPos).toMatchObject({ x: 0, y: 8, h: 2, w: 6 });
        expect(dashboard.panels[13].gridPos).toMatchObject({ x: 6, y: 8, h: 2, w: 6 });
    });
});
describe('given dashboard with row repeat', function () {
    var dashboard, dashboardJSON;
    beforeEach(function () {
        dashboardJSON = {
            panels: [
                {
                    id: 1,
                    type: 'row',
                    gridPos: { x: 0, y: 0, h: 1, w: 24 },
                    repeat: 'apps',
                },
                { id: 2, type: 'graph', gridPos: { x: 0, y: 1, h: 1, w: 6 } },
                { id: 3, type: 'graph', gridPos: { x: 6, y: 1, h: 1, w: 6 } },
                { id: 4, type: 'row', gridPos: { x: 0, y: 2, h: 1, w: 24 } },
                { id: 5, type: 'graph', gridPos: { x: 0, y: 3, h: 1, w: 12 } },
            ],
            templating: {
                list: [
                    {
                        name: 'apps',
                        type: 'custom',
                        current: {
                            text: 'se1, se2',
                            value: ['se1', 'se2'],
                        },
                        options: [
                            { text: 'se1', value: 'se1', selected: true },
                            { text: 'se2', value: 'se2', selected: true },
                            { text: 'se3', value: 'se3', selected: false },
                        ],
                    },
                ],
            },
        };
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats();
    });
    it('should not repeat only row', function () {
        var panelTypes = map(dashboard.panels, 'type');
        expect(panelTypes).toEqual(['row', 'graph', 'graph', 'row', 'graph', 'graph', 'row', 'graph']);
    });
    it('should set scopedVars for each panel', function () {
        dashboardJSON.templating.list[0].options[2].selected = true;
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats();
        expect(dashboard.panels[1].scopedVars).toMatchObject({
            apps: { text: 'se1', value: 'se1' },
        });
        expect(dashboard.panels[4].scopedVars).toMatchObject({
            apps: { text: 'se2', value: 'se2' },
        });
        var scopedVars = compact(map(dashboard.panels, function (panel) {
            return panel.scopedVars ? panel.scopedVars.apps.value : null;
        }));
        expect(scopedVars).toEqual(['se1', 'se1', 'se1', 'se2', 'se2', 'se2', 'se3', 'se3', 'se3']);
    });
    it('should repeat only configured row', function () {
        expect(dashboard.panels[6].id).toBe(4);
        expect(dashboard.panels[7].id).toBe(5);
    });
    it('should repeat only row if it is collapsed', function () {
        dashboardJSON.panels = [
            {
                id: 1,
                type: 'row',
                collapsed: true,
                repeat: 'apps',
                gridPos: { x: 0, y: 0, h: 1, w: 24 },
                panels: [
                    { id: 2, type: 'graph', gridPos: { x: 0, y: 1, h: 1, w: 6 } },
                    { id: 3, type: 'graph', gridPos: { x: 6, y: 1, h: 1, w: 6 } },
                ],
            },
            { id: 4, type: 'row', gridPos: { x: 0, y: 1, h: 1, w: 24 } },
            { id: 5, type: 'graph', gridPos: { x: 0, y: 2, h: 1, w: 12 } },
        ];
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats();
        var panelTypes = map(dashboard.panels, 'type');
        expect(panelTypes).toEqual(['row', 'row', 'row', 'graph']);
        expect(dashboard.panels[0].panels).toHaveLength(2);
        expect(dashboard.panels[1].panels).toHaveLength(2);
    });
    it('should properly repeat multiple rows', function () {
        dashboardJSON.panels = [
            {
                id: 1,
                type: 'row',
                gridPos: { x: 0, y: 0, h: 1, w: 24 },
                repeat: 'apps',
            },
            { id: 2, type: 'graph', gridPos: { x: 0, y: 1, h: 1, w: 6 } },
            { id: 3, type: 'graph', gridPos: { x: 6, y: 1, h: 1, w: 6 } },
            { id: 4, type: 'row', gridPos: { x: 0, y: 2, h: 1, w: 24 } },
            { id: 5, type: 'graph', gridPos: { x: 0, y: 3, h: 1, w: 12 } },
            {
                id: 6,
                type: 'row',
                gridPos: { x: 0, y: 4, h: 1, w: 24 },
                repeat: 'hosts',
            },
            { id: 7, type: 'graph', gridPos: { x: 0, y: 5, h: 1, w: 6 } },
            { id: 8, type: 'graph', gridPos: { x: 6, y: 5, h: 1, w: 6 } },
        ];
        dashboardJSON.templating.list.push({
            name: 'hosts',
            type: 'custom',
            current: {
                text: 'backend01, backend02',
                value: ['backend01', 'backend02'],
            },
            options: [
                { text: 'backend01', value: 'backend01', selected: true },
                { text: 'backend02', value: 'backend02', selected: true },
                { text: 'backend03', value: 'backend03', selected: false },
            ],
        });
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats();
        var panelTypes = map(dashboard.panels, 'type');
        expect(panelTypes).toEqual([
            'row',
            'graph',
            'graph',
            'row',
            'graph',
            'graph',
            'row',
            'graph',
            'row',
            'graph',
            'graph',
            'row',
            'graph',
            'graph',
        ]);
        expect(dashboard.panels[0].scopedVars['apps'].value).toBe('se1');
        expect(dashboard.panels[1].scopedVars['apps'].value).toBe('se1');
        expect(dashboard.panels[3].scopedVars['apps'].value).toBe('se2');
        expect(dashboard.panels[4].scopedVars['apps'].value).toBe('se2');
        expect(dashboard.panels[8].scopedVars['hosts'].value).toBe('backend01');
        expect(dashboard.panels[9].scopedVars['hosts'].value).toBe('backend01');
        expect(dashboard.panels[11].scopedVars['hosts'].value).toBe('backend02');
        expect(dashboard.panels[12].scopedVars['hosts'].value).toBe('backend02');
    });
    it('should assign unique ids for repeated panels', function () {
        dashboardJSON.panels = [
            {
                id: 1,
                type: 'row',
                collapsed: true,
                repeat: 'apps',
                gridPos: { x: 0, y: 0, h: 1, w: 24 },
                panels: [
                    { id: 2, type: 'graph', gridPos: { x: 0, y: 1, h: 1, w: 6 } },
                    { id: 3, type: 'graph', gridPos: { x: 6, y: 1, h: 1, w: 6 } },
                ],
            },
            { id: 4, type: 'row', gridPos: { x: 0, y: 1, h: 1, w: 24 } },
            { id: 5, type: 'graph', gridPos: { x: 0, y: 2, h: 1, w: 12 } },
        ];
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats();
        var panelIds = flattenDeep(map(dashboard.panels, function (panel) {
            var ids = [];
            if (panel.panels && panel.panels.length) {
                ids = map(panel.panels, 'id');
            }
            ids.push(panel.id);
            return ids;
        }));
        expect(panelIds.length).toEqual(uniq(panelIds).length);
    });
    it('should place new panels in proper order', function () {
        dashboardJSON.panels = [
            { id: 1, type: 'row', gridPos: { x: 0, y: 0, h: 1, w: 24 }, repeat: 'apps' },
            { id: 2, type: 'graph', gridPos: { x: 0, y: 1, h: 3, w: 12 } },
            { id: 3, type: 'graph', gridPos: { x: 6, y: 1, h: 4, w: 12 } },
            { id: 4, type: 'graph', gridPos: { x: 0, y: 5, h: 2, w: 12 } },
        ];
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats();
        var panelTypes = map(dashboard.panels, 'type');
        expect(panelTypes).toEqual(['row', 'graph', 'graph', 'graph', 'row', 'graph', 'graph', 'graph']);
        var panelYPositions = map(dashboard.panels, function (p) { return p.gridPos.y; });
        expect(panelYPositions).toEqual([0, 1, 1, 5, 7, 8, 8, 12]);
    });
});
describe('given dashboard with row and panel repeat', function () {
    var dashboard, dashboardJSON;
    beforeEach(function () {
        dashboardJSON = {
            panels: [
                {
                    id: 1,
                    type: 'row',
                    repeat: 'region',
                    gridPos: { x: 0, y: 0, h: 1, w: 24 },
                },
                { id: 2, type: 'graph', repeat: 'app', gridPos: { x: 0, y: 1, h: 1, w: 6 } },
            ],
            templating: {
                list: [
                    {
                        name: 'region',
                        type: 'custom',
                        current: {
                            text: 'reg1, reg2',
                            value: ['reg1', 'reg2'],
                        },
                        options: [
                            { text: 'reg1', value: 'reg1', selected: true },
                            { text: 'reg2', value: 'reg2', selected: true },
                            { text: 'reg3', value: 'reg3', selected: false },
                        ],
                    },
                    {
                        name: 'app',
                        type: 'custom',
                        current: {
                            text: 'se1, se2',
                            value: ['se1', 'se2'],
                        },
                        options: [
                            { text: 'se1', value: 'se1', selected: true },
                            { text: 'se2', value: 'se2', selected: true },
                            { text: 'se3', value: 'se3', selected: false },
                        ],
                    },
                ],
            },
        };
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats();
    });
    it('should repeat row and panels for each row', function () {
        var panelTypes = map(dashboard.panels, 'type');
        expect(panelTypes).toEqual(['row', 'graph', 'graph', 'row', 'graph', 'graph']);
    });
    it('should clean up old repeated panels', function () {
        dashboardJSON.panels = [
            {
                id: 1,
                type: 'row',
                repeat: 'region',
                gridPos: { x: 0, y: 0, h: 1, w: 24 },
            },
            { id: 2, type: 'graph', repeat: 'app', gridPos: { x: 0, y: 1, h: 1, w: 6 } },
            { id: 3, type: 'graph', repeatPanelId: 2, repeatIteration: 101, gridPos: { x: 7, y: 1, h: 1, w: 6 } },
            {
                id: 11,
                type: 'row',
                repeatPanelId: 1,
                repeatIteration: 101,
                gridPos: { x: 0, y: 2, h: 1, w: 24 },
            },
            { id: 12, type: 'graph', repeatPanelId: 2, repeatIteration: 101, gridPos: { x: 0, y: 3, h: 1, w: 6 } },
        ];
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats();
        var panelTypes = map(dashboard.panels, 'type');
        expect(panelTypes).toEqual(['row', 'graph', 'graph', 'row', 'graph', 'graph']);
    });
    it('should set scopedVars for each row', function () {
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats();
        expect(dashboard.panels[0].scopedVars).toMatchObject({
            region: { text: 'reg1', value: 'reg1' },
        });
        expect(dashboard.panels[3].scopedVars).toMatchObject({
            region: { text: 'reg2', value: 'reg2' },
        });
    });
    it('should set panel-repeat variable for each panel', function () {
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats();
        expect(dashboard.panels[1].scopedVars).toMatchObject({
            app: { text: 'se1', value: 'se1' },
        });
        expect(dashboard.panels[2].scopedVars).toMatchObject({
            app: { text: 'se2', value: 'se2' },
        });
        expect(dashboard.panels[4].scopedVars).toMatchObject({
            app: { text: 'se1', value: 'se1' },
        });
        expect(dashboard.panels[5].scopedVars).toMatchObject({
            app: { text: 'se2', value: 'se2' },
        });
    });
    it('should set row-repeat variable for each panel', function () {
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats();
        expect(dashboard.panels[1].scopedVars).toMatchObject({
            region: { text: 'reg1', value: 'reg1' },
        });
        expect(dashboard.panels[2].scopedVars).toMatchObject({
            region: { text: 'reg1', value: 'reg1' },
        });
        expect(dashboard.panels[4].scopedVars).toMatchObject({
            region: { text: 'reg2', value: 'reg2' },
        });
        expect(dashboard.panels[5].scopedVars).toMatchObject({
            region: { text: 'reg2', value: 'reg2' },
        });
    });
    it('should repeat panels when row is expanding', function () {
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.processRepeats();
        expect(dashboard.panels.length).toBe(6);
        // toggle row
        dashboard.toggleRow(dashboard.panels[0]);
        dashboard.toggleRow(dashboard.panels[1]);
        expect(dashboard.panels.length).toBe(2);
        // change variable
        dashboard.templating.list[1].current.value = ['se1', 'se2', 'se3'];
        // toggle row back
        dashboard.toggleRow(dashboard.panels[1]);
        expect(dashboard.panels.length).toBe(4);
    });
});
// fix for https://github.com/grafana/grafana/issues/38805
describe('given dashboard with row and repeats on same row', function () {
    it('should set correct gridPos when row is expanding', function () {
        var ROW1 = 1;
        var GAUGE1 = 2;
        var REPEAT1 = 3;
        var GAUGE2 = 4;
        var REPEAT2 = 5;
        var GAUGE3 = 6;
        var dashboardJSON = {
            panels: [
                {
                    collapsed: true,
                    datasource: null,
                    gridPos: { h: 1, w: 24, x: 0, y: 0 },
                    id: ROW1,
                    panels: [
                        { gridPos: { h: 5, w: 4, x: 0, y: 1 }, id: GAUGE1, type: 'gauge' },
                        {
                            gridPos: { h: 5, w: 4, x: 4, y: 1 },
                            id: REPEAT1,
                            repeat: 'abc',
                            repeatDirection: 'v',
                            type: 'gauge',
                        },
                        { gridPos: { h: 5, w: 4, x: 8, y: 1 }, id: GAUGE2, type: 'gauge' },
                        {
                            gridPos: { h: 5, w: 4, x: 12, y: 1 },
                            id: REPEAT2,
                            repeat: 'abc',
                            repeatDirection: 'v',
                            type: 'gauge',
                        },
                        { gridPos: { h: 5, w: 4, x: 16, y: 1 }, id: GAUGE3, type: 'gauge' },
                    ],
                    title: 'Row title',
                    type: 'row',
                },
            ],
            templating: {
                list: [
                    {
                        allValue: null,
                        current: { selected: true, text: ['All'], value: ['$__all'] },
                        includeAll: true,
                        name: 'abc',
                        options: [
                            { selected: true, text: 'All', value: '$__all' },
                            { selected: false, text: 'a', value: 'a' },
                            { selected: false, text: 'b', value: 'b' },
                            { selected: false, text: 'c', value: 'c' },
                            { selected: false, text: 'd', value: 'd' },
                            { selected: false, text: 'e', value: 'e' },
                            { selected: false, text: 'f', value: 'f' },
                            { selected: false, text: 'g', value: 'g' },
                        ],
                        type: 'custom',
                    },
                ],
            },
        };
        var dashboard = getDashboardModel(dashboardJSON);
        // toggle row
        dashboard.toggleRow(dashboard.panels[0]);
        // correct number of panels
        expect(dashboard.panels.length).toBe(18);
        // check row
        var rowPanel = dashboard.panels.find(function (p) { return p.id === ROW1; });
        expect(rowPanel === null || rowPanel === void 0 ? void 0 : rowPanel.gridPos).toEqual({ x: 0, y: 0, w: 24, h: 1 });
        // check the gridPos of all the top level panels that are next to each other
        var firstGauge = dashboard.panels.find(function (p) { return p.id === GAUGE1; });
        var secondGauge = dashboard.panels.find(function (p) { return p.id === GAUGE2; });
        var thirdGauge = dashboard.panels.find(function (p) { return p.id === GAUGE3; });
        var firstVerticalRepeatingGauge = dashboard.panels.find(function (p) { return p.id === REPEAT1; });
        var secondVerticalRepeatingGauge = dashboard.panels.find(function (p) { return p.id === REPEAT2; });
        expect(firstGauge === null || firstGauge === void 0 ? void 0 : firstGauge.gridPos).toEqual({ x: 0, y: 1, w: 4, h: 5 });
        expect(secondGauge === null || secondGauge === void 0 ? void 0 : secondGauge.gridPos).toEqual({ x: 8, y: 1, w: 4, h: 5 });
        expect(thirdGauge === null || thirdGauge === void 0 ? void 0 : thirdGauge.gridPos).toEqual({ x: 16, y: 1, w: 4, h: 5 });
        expect(firstVerticalRepeatingGauge === null || firstVerticalRepeatingGauge === void 0 ? void 0 : firstVerticalRepeatingGauge.gridPos).toEqual({ x: 4, y: 1, w: 4, h: 5 });
        expect(secondVerticalRepeatingGauge === null || secondVerticalRepeatingGauge === void 0 ? void 0 : secondVerticalRepeatingGauge.gridPos).toEqual({ x: 12, y: 1, w: 4, h: 5 });
        // check the gridPos of all first vertical repeats children
        var _a = firstVerticalRepeatingGauge.gridPos, x = _a.x, h = _a.h, w = _a.w;
        expect(dashboard.panels[6].gridPos).toEqual({ x: x, y: 6, w: w, h: h });
        expect(dashboard.panels[8].gridPos).toEqual({ x: x, y: 11, w: w, h: h });
        expect(dashboard.panels[10].gridPos).toEqual({ x: x, y: 16, w: w, h: h });
        expect(dashboard.panels[12].gridPos).toEqual({ x: x, y: 21, w: w, h: h });
        expect(dashboard.panels[14].gridPos).toEqual({ x: x, y: 26, w: w, h: h });
        expect(dashboard.panels[16].gridPos).toEqual({ x: x, y: 31, w: w, h: h });
        // check the gridPos of all second vertical repeats children
        var _b = secondVerticalRepeatingGauge.gridPos, x2 = _b.x, h2 = _b.h, w2 = _b.w;
        expect(dashboard.panels[7].gridPos).toEqual({ x: x2, y: 6, w: w2, h: h2 });
        expect(dashboard.panels[9].gridPos).toEqual({ x: x2, y: 11, w: w2, h: h2 });
        expect(dashboard.panels[11].gridPos).toEqual({ x: x2, y: 16, w: w2, h: h2 });
        expect(dashboard.panels[13].gridPos).toEqual({ x: x2, y: 21, w: w2, h: h2 });
        expect(dashboard.panels[15].gridPos).toEqual({ x: x2, y: 26, w: w2, h: h2 });
        expect(dashboard.panels[17].gridPos).toEqual({ x: x2, y: 31, w: w2, h: h2 });
    });
});
describe('given panel is in view mode', function () {
    var dashboard;
    beforeEach(function () {
        var dashboardJSON = {
            panels: [
                {
                    id: 1,
                    repeat: 'apps',
                    repeatDirection: 'h',
                    gridPos: { x: 0, y: 0, h: 2, w: 24 },
                },
            ],
            templating: {
                list: [
                    {
                        name: 'apps',
                        type: 'custom',
                        current: {
                            text: 'se1, se2, se3',
                            value: ['se1', 'se2', 'se3'],
                        },
                        options: [
                            { text: 'se1', value: 'se1', selected: true },
                            { text: 'se2', value: 'se2', selected: true },
                            { text: 'se3', value: 'se3', selected: true },
                            { text: 'se4', value: 'se4', selected: false },
                        ],
                    },
                ],
            },
        };
        dashboard = getDashboardModel(dashboardJSON);
        dashboard.initViewPanel(new PanelModel({
            id: 2,
            repeat: undefined,
            repeatDirection: 'h',
            panels: [
                {
                    id: 2,
                    repeat: 'apps',
                    repeatDirection: 'h',
                    gridPos: { x: 0, y: 0, h: 2, w: 24 },
                },
            ],
            repeatPanelId: 2,
        }));
        dashboard.processRepeats();
    });
    it('should set correct repeated panel to be in view', function () {
        expect(dashboard.panels[1].isViewing).toBeTruthy();
    });
});
//# sourceMappingURL=DashboardModel.repeat.test.js.map