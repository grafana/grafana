import { __makeTemplateObject } from "tslib";
import { keys as _keys } from 'lodash';
import { DashboardModel } from '../state/DashboardModel';
import { PanelModel } from '../state/PanelModel';
import { getDashboardModel } from '../../../../test/helpers/getDashboardModel';
import { variableAdapters } from '../../variables/adapters';
import { createAdHocVariableAdapter } from '../../variables/adhoc/adapter';
import { createQueryVariableAdapter } from '../../variables/query/adapter';
import { createCustomVariableAdapter } from '../../variables/custom/adapter';
import { expect } from '../../../../test/lib/common';
import { setTimeSrv } from '../services/TimeSrv';
jest.mock('app/core/services/context_srv', function () { return ({}); });
variableAdapters.setInit(function () { return [
    createQueryVariableAdapter(),
    createAdHocVariableAdapter(),
    createCustomVariableAdapter(),
]; });
describe('DashboardModel', function () {
    describe('when creating new dashboard model defaults only', function () {
        var model;
        beforeEach(function () {
            model = new DashboardModel({}, {});
        });
        it('should have title', function () {
            expect(model.title).toBe('No Title');
        });
        it('should have meta', function () {
            expect(model.meta.canSave).toBe(true);
            expect(model.meta.canShare).toBe(true);
        });
        it('should have default properties', function () {
            expect(model.panels.length).toBe(0);
        });
    });
    describe('when getting next panel id', function () {
        var model;
        beforeEach(function () {
            model = new DashboardModel({
                panels: [{ id: 5 }],
            });
        });
        it('should return max id + 1', function () {
            expect(model.getNextPanelId()).toBe(6);
        });
    });
    describe('getSaveModelClone', function () {
        it('should sort keys', function () {
            var model = new DashboardModel({});
            var saveModel = model.getSaveModelClone();
            var keys = _keys(saveModel);
            expect(keys[0]).toBe('annotations');
            expect(keys[1]).toBe('autoUpdate');
        });
        it('should remove add panel panels', function () {
            var model = new DashboardModel({});
            model.addPanel({
                type: 'add-panel',
            });
            model.addPanel({
                type: 'graph',
            });
            model.addPanel({
                type: 'add-panel',
            });
            var saveModel = model.getSaveModelClone();
            var panels = saveModel.panels;
            expect(panels.length).toBe(1);
        });
        it('should save model in edit mode', function () {
            var model = new DashboardModel({});
            model.addPanel({ type: 'graph' });
            var panel = model.initEditPanel(model.panels[0]);
            panel.title = 'updated';
            var saveModel = model.getSaveModelClone();
            var savedPanel = saveModel.panels[0];
            expect(savedPanel.title).toBe('updated');
            expect(savedPanel.id).toBe(model.panels[0].id);
        });
    });
    describe('row and panel manipulation', function () {
        var dashboard;
        beforeEach(function () {
            dashboard = new DashboardModel({});
        });
        it('adding panel should new up panel model', function () {
            dashboard.addPanel({ type: 'test', title: 'test' });
            expect(dashboard.panels[0] instanceof PanelModel).toBe(true);
        });
        it('duplicate panel should try to add to the right if there is space', function () {
            var panel = { id: 10, gridPos: { x: 0, y: 0, w: 6, h: 2 } };
            dashboard.addPanel(panel);
            dashboard.duplicatePanel(dashboard.panels[0]);
            expect(dashboard.panels[1].gridPos).toMatchObject({
                x: 6,
                y: 0,
                h: 2,
                w: 6,
            });
        });
        it('duplicate panel should remove repeat data', function () {
            var panel = {
                id: 10,
                gridPos: { x: 0, y: 0, w: 6, h: 2 },
                repeat: 'asd',
                scopedVars: { test: 'asd' },
            };
            dashboard.addPanel(panel);
            dashboard.duplicatePanel(dashboard.panels[0]);
            expect(dashboard.panels[1].repeat).toBe(undefined);
            expect(dashboard.panels[1].scopedVars).toBe(undefined);
        });
    });
    describe('Given editable false dashboard', function () {
        var model;
        beforeEach(function () {
            model = new DashboardModel({ editable: false });
        });
        it('Should set meta canEdit and canSave to false', function () {
            expect(model.meta.canSave).toBe(false);
            expect(model.meta.canEdit).toBe(false);
        });
        it('getSaveModelClone should remove meta', function () {
            var clone = model.getSaveModelClone();
            expect(clone.meta).toBe(undefined);
        });
    });
    describe('when loading dashboard with old influxdb query schema', function () {
        var model;
        var target;
        beforeEach(function () {
            model = new DashboardModel({
                panels: [
                    {
                        type: 'graph',
                        grid: {},
                        yaxes: [{}, {}],
                        targets: [
                            {
                                alias: '$tag_datacenter $tag_source $col',
                                column: 'value',
                                measurement: 'logins.count',
                                fields: [
                                    {
                                        func: 'mean',
                                        name: 'value',
                                        mathExpr: '*2',
                                        asExpr: 'value',
                                    },
                                    {
                                        name: 'one-minute',
                                        func: 'mean',
                                        mathExpr: '*3',
                                        asExpr: 'one-minute',
                                    },
                                ],
                                tags: [],
                                fill: 'previous',
                                function: 'mean',
                                groupBy: [
                                    {
                                        interval: 'auto',
                                        type: 'time',
                                    },
                                    {
                                        key: 'source',
                                        type: 'tag',
                                    },
                                    {
                                        type: 'tag',
                                        key: 'datacenter',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });
            target = model.panels[0].targets[0];
        });
        it('should update query schema', function () {
            expect(target.fields).toBe(undefined);
            expect(target.select.length).toBe(2);
            expect(target.select[0].length).toBe(4);
            expect(target.select[0][0].type).toBe('field');
            expect(target.select[0][1].type).toBe('mean');
            expect(target.select[0][2].type).toBe('math');
            expect(target.select[0][3].type).toBe('alias');
        });
    });
    describe('when creating dashboard model with missing list for annoations or templating', function () {
        var model;
        beforeEach(function () {
            model = new DashboardModel({
                annotations: {
                    enable: true,
                },
                templating: {
                    enable: true,
                },
            });
        });
        it('should add empty list', function () {
            expect(model.annotations.list.length).toBe(1);
            expect(model.templating.list.length).toBe(0);
        });
        it('should add builtin annotation query', function () {
            expect(model.annotations.list[0].builtIn).toBe(1);
            expect(model.templating.list.length).toBe(0);
        });
    });
    describe('Formatting epoch timestamp when timezone is set as utc', function () {
        var dashboard;
        beforeEach(function () {
            dashboard = new DashboardModel({ timezone: 'utc' });
        });
        it('Should format timestamp with second resolution by default', function () {
            expect(dashboard.formatDate(1234567890000)).toBe('2009-02-13 23:31:30');
        });
        it('Should format timestamp with second resolution even if second format is passed as parameter', function () {
            expect(dashboard.formatDate(1234567890007, 'YYYY-MM-DD HH:mm:ss')).toBe('2009-02-13 23:31:30');
        });
        it('Should format timestamp with millisecond resolution if format is passed as parameter', function () {
            expect(dashboard.formatDate(1234567890007, 'YYYY-MM-DD HH:mm:ss.SSS')).toBe('2009-02-13 23:31:30.007');
        });
    });
    describe('isSubMenuVisible with empty lists', function () {
        var model;
        beforeEach(function () {
            model = new DashboardModel({});
        });
        it('should not show submenu', function () {
            expect(model.isSubMenuVisible()).toBe(false);
        });
    });
    describe('isSubMenuVisible with annotation', function () {
        var model;
        beforeEach(function () {
            model = new DashboardModel({
                annotations: {
                    list: [{}],
                },
            });
        });
        it('should show submmenu', function () {
            expect(model.isSubMenuVisible()).toBe(true);
        });
    });
    describe('isSubMenuVisible with template var', function () {
        var model;
        beforeEach(function () {
            model = new DashboardModel({
                templating: {
                    list: [{}],
                },
            }, {}, 
            // getVariablesFromState stub to return a variable
            function () { return [{}]; });
        });
        it('should enable submmenu', function () {
            expect(model.isSubMenuVisible()).toBe(true);
        });
    });
    describe('isSubMenuVisible with hidden template var', function () {
        var model;
        beforeEach(function () {
            model = new DashboardModel({
                templating: {
                    list: [{ hide: 2 }],
                },
            });
        });
        it('should not enable submmenu', function () {
            expect(model.isSubMenuVisible()).toBe(false);
        });
    });
    describe('isSubMenuVisible with hidden annotation toggle', function () {
        var dashboard;
        beforeEach(function () {
            dashboard = new DashboardModel({
                annotations: {
                    list: [{ hide: true }],
                },
            });
        });
        it('should not enable submmenu', function () {
            expect(dashboard.isSubMenuVisible()).toBe(false);
        });
    });
    describe('When collapsing row', function () {
        var dashboard;
        beforeEach(function () {
            dashboard = new DashboardModel({
                panels: [
                    { id: 1, type: 'graph', gridPos: { x: 0, y: 0, w: 24, h: 2 } },
                    { id: 2, type: 'row', gridPos: { x: 0, y: 2, w: 24, h: 2 } },
                    { id: 3, type: 'graph', gridPos: { x: 0, y: 4, w: 12, h: 2 } },
                    { id: 4, type: 'graph', gridPos: { x: 12, y: 4, w: 12, h: 2 } },
                    { id: 5, type: 'row', gridPos: { x: 0, y: 6, w: 24, h: 2 } },
                ],
            });
            dashboard.toggleRow(dashboard.panels[1]);
        });
        it('should remove panels and put them inside collapsed row', function () {
            expect(dashboard.panels.length).toBe(3);
            expect(dashboard.panels[1].panels.length).toBe(2);
        });
        describe('and when removing row and its panels', function () {
            beforeEach(function () {
                dashboard.removeRow(dashboard.panels[1], true);
            });
            it('should remove row and its panels', function () {
                expect(dashboard.panels.length).toBe(2);
            });
        });
        describe('and when removing only the row', function () {
            beforeEach(function () {
                dashboard.removeRow(dashboard.panels[1], false);
            });
            it('should only remove row', function () {
                expect(dashboard.panels.length).toBe(4);
            });
        });
    });
    describe('When expanding row', function () {
        var dashboard;
        beforeEach(function () {
            dashboard = new DashboardModel({
                panels: [
                    { id: 1, type: 'graph', gridPos: { x: 0, y: 0, w: 24, h: 6 } },
                    {
                        id: 2,
                        type: 'row',
                        gridPos: { x: 0, y: 6, w: 24, h: 1 },
                        collapsed: true,
                        panels: [
                            { id: 3, type: 'graph', gridPos: { x: 0, y: 7, w: 12, h: 2 } },
                            { id: 4, type: 'graph', gridPos: { x: 12, y: 7, w: 12, h: 2 } },
                        ],
                    },
                    { id: 5, type: 'row', gridPos: { x: 0, y: 7, w: 1, h: 1 } },
                ],
            });
            dashboard.toggleRow(dashboard.panels[1]);
        });
        it('should add panels back', function () {
            expect(dashboard.panels.length).toBe(5);
        });
        it('should add them below row in array', function () {
            expect(dashboard.panels[2].id).toBe(3);
            expect(dashboard.panels[3].id).toBe(4);
        });
        it('should position them below row', function () {
            expect(dashboard.panels[2].gridPos).toMatchObject({
                x: 0,
                y: 7,
                w: 12,
                h: 2,
            });
        });
        it('should move panels below down', function () {
            expect(dashboard.panels[4].gridPos).toMatchObject({
                x: 0,
                y: 9,
                w: 1,
                h: 1,
            });
        });
        describe('and when removing row and its panels', function () {
            beforeEach(function () {
                dashboard.removeRow(dashboard.panels[1], true);
            });
            it('should remove row and its panels', function () {
                expect(dashboard.panels.length).toBe(2);
            });
        });
        describe('and when removing only the row', function () {
            beforeEach(function () {
                dashboard.removeRow(dashboard.panels[1], false);
            });
            it('should only remove row', function () {
                expect(dashboard.panels.length).toBe(4);
            });
        });
    });
    describe('Given model with time', function () {
        var model;
        beforeEach(function () {
            model = new DashboardModel({
                time: {
                    from: 'now-6h',
                    to: 'now',
                },
            });
            expect(model.hasTimeChanged()).toBeFalsy();
            model.time = {
                from: 'now-3h',
                to: 'now-1h',
            };
        });
        it('hasTimeChanged should be true', function () {
            expect(model.hasTimeChanged()).toBeTruthy();
        });
        it('getSaveModelClone should return original time when saveTimerange=false', function () {
            var options = { saveTimerange: false };
            var saveModel = model.getSaveModelClone(options);
            expect(saveModel.time.from).toBe('now-6h');
            expect(saveModel.time.to).toBe('now');
        });
        it('getSaveModelClone should return updated time when saveTimerange=true', function () {
            var options = { saveTimerange: true };
            var saveModel = model.getSaveModelClone(options);
            expect(saveModel.time.from).toBe('now-3h');
            expect(saveModel.time.to).toBe('now-1h');
        });
        it('hasTimeChanged should be false when reset original time', function () {
            model.resetOriginalTime();
            expect(model.hasTimeChanged()).toBeFalsy();
        });
        it('getSaveModelClone should return original time when saveTimerange=false', function () {
            var options = { saveTimerange: false };
            var saveModel = model.getSaveModelClone(options);
            expect(saveModel.time.from).toBe('now-6h');
            expect(saveModel.time.to).toBe('now');
        });
        it('getSaveModelClone should return updated time when saveTimerange=true', function () {
            var options = { saveTimerange: true };
            var saveModel = model.getSaveModelClone(options);
            expect(saveModel.time.from).toBe('now-3h');
            expect(saveModel.time.to).toBe('now-1h');
        });
        it('getSaveModelClone should remove repeated panels and scopedVars', function () {
            var _a, _b, _c, _d;
            var dashboardJSON = {
                panels: [
                    { id: 1, type: 'row', repeat: 'dc', gridPos: { x: 0, y: 0, h: 1, w: 24 } },
                    { id: 2, repeat: 'app', repeatDirection: 'h', gridPos: { x: 0, y: 1, h: 2, w: 8 } },
                ],
                templating: {
                    list: [
                        {
                            name: 'dc',
                            type: 'custom',
                            current: {
                                text: 'dc1 + dc2',
                                value: ['dc1', 'dc2'],
                            },
                            options: [
                                { text: 'dc1', value: 'dc1', selected: true },
                                { text: 'dc2', value: 'dc2', selected: true },
                            ],
                        },
                        {
                            name: 'app',
                            type: 'custom',
                            current: {
                                text: 'se1 + se2',
                                value: ['se1', 'se2'],
                            },
                            options: [
                                { text: 'se1', value: 'se1', selected: true },
                                { text: 'se2', value: 'se2', selected: true },
                            ],
                        },
                    ],
                },
            };
            var model = getDashboardModel(dashboardJSON);
            model.processRepeats();
            expect(model.panels.filter(function (x) { return x.type === 'row'; })).toHaveLength(2);
            expect(model.panels.filter(function (x) { return x.type !== 'row'; })).toHaveLength(4);
            expect((_b = (_a = model.panels.find(function (x) { return x.type !== 'row'; })) === null || _a === void 0 ? void 0 : _a.scopedVars) === null || _b === void 0 ? void 0 : _b.dc.value).toBe('dc1');
            expect((_d = (_c = model.panels.find(function (x) { return x.type !== 'row'; })) === null || _c === void 0 ? void 0 : _c.scopedVars) === null || _d === void 0 ? void 0 : _d.app.value).toBe('se1');
            var saveModel = model.getSaveModelClone();
            expect(saveModel.panels.length).toBe(2);
            expect(saveModel.panels[0].scopedVars).toBe(undefined);
            expect(saveModel.panels[1].scopedVars).toBe(undefined);
            model.collapseRows();
            var savedModelWithCollapsedRows = model.getSaveModelClone();
            expect(savedModelWithCollapsedRows.panels[0].panels.length).toBe(1);
        });
        it('getSaveModelClone should not remove repeated panels and scopedVars during snapshot', function () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            var dashboardJSON = {
                panels: [
                    { id: 1, type: 'row', repeat: 'dc', gridPos: { x: 0, y: 0, h: 1, w: 24 } },
                    { id: 2, repeat: 'app', repeatDirection: 'h', gridPos: { x: 0, y: 1, h: 2, w: 8 } },
                ],
                templating: {
                    list: [
                        {
                            name: 'dc',
                            type: 'custom',
                            current: {
                                text: 'dc1 + dc2',
                                value: ['dc1', 'dc2'],
                            },
                            options: [
                                { text: 'dc1', value: 'dc1', selected: true },
                                { text: 'dc2', value: 'dc2', selected: true },
                            ],
                        },
                        {
                            name: 'app',
                            type: 'custom',
                            current: {
                                text: 'se1 + se2',
                                value: ['se1', 'se2'],
                            },
                            options: [
                                { text: 'se1', value: 'se1', selected: true },
                                { text: 'se2', value: 'se2', selected: true },
                            ],
                        },
                    ],
                },
            };
            var model = getDashboardModel(dashboardJSON);
            model.processRepeats();
            expect(model.panels.filter(function (x) { return x.type === 'row'; })).toHaveLength(2);
            expect(model.panels.filter(function (x) { return x.type !== 'row'; })).toHaveLength(4);
            expect((_b = (_a = model.panels.find(function (x) { return x.type !== 'row'; })) === null || _a === void 0 ? void 0 : _a.scopedVars) === null || _b === void 0 ? void 0 : _b.dc.value).toBe('dc1');
            expect((_d = (_c = model.panels.find(function (x) { return x.type !== 'row'; })) === null || _c === void 0 ? void 0 : _c.scopedVars) === null || _d === void 0 ? void 0 : _d.app.value).toBe('se1');
            model.snapshot = { timestamp: new Date() };
            var saveModel = model.getSaveModelClone();
            expect(saveModel.panels.filter(function (x) { return x.type === 'row'; })).toHaveLength(2);
            expect(saveModel.panels.filter(function (x) { return x.type !== 'row'; })).toHaveLength(4);
            expect((_f = (_e = saveModel.panels.find(function (x) { return x.type !== 'row'; })) === null || _e === void 0 ? void 0 : _e.scopedVars) === null || _f === void 0 ? void 0 : _f.dc.value).toBe('dc1');
            expect((_h = (_g = saveModel.panels.find(function (x) { return x.type !== 'row'; })) === null || _g === void 0 ? void 0 : _g.scopedVars) === null || _h === void 0 ? void 0 : _h.app.value).toBe('se1');
            model.collapseRows();
            var savedModelWithCollapsedRows = model.getSaveModelClone();
            expect(savedModelWithCollapsedRows.panels[0].panels.length).toBe(2);
        });
    });
    describe('Given model with template variable of type query', function () {
        var model;
        beforeEach(function () {
            var json = {
                templating: {
                    list: [
                        {
                            name: 'Server',
                            type: 'query',
                            current: {
                                selected: true,
                                text: 'server_001',
                                value: 'server_001',
                            },
                        },
                    ],
                },
            };
            model = getDashboardModel(json);
            expect(model.hasVariableValuesChanged()).toBeFalsy();
        });
        it('hasVariableValuesChanged should be false when adding a template variable', function () {
            model.templating.list.push({
                name: 'Server2',
                type: 'query',
                current: {
                    selected: true,
                    text: 'server_002',
                    value: 'server_002',
                },
            });
            expect(model.hasVariableValuesChanged()).toBeFalsy();
        });
        it('hasVariableValuesChanged should be false when removing existing template variable', function () {
            model.templating.list = [];
            expect(model.hasVariableValuesChanged()).toBeFalsy();
        });
        it('hasVariableValuesChanged should be true when changing value of template variable', function () {
            model.templating.list[0].current.text = 'server_002';
            expect(model.hasVariableValuesChanged()).toBeTruthy();
        });
        it('getSaveModelClone should return original variable when saveVariables=false', function () {
            model.templating.list[0].current.text = 'server_002';
            var options = { saveVariables: false };
            var saveModel = model.getSaveModelClone(options);
            expect(saveModel.templating.list[0].current.text).toBe('server_001');
        });
        it('getSaveModelClone should return updated variable when saveVariables=true', function () {
            model.templating.list[0].current.text = 'server_002';
            var options = { saveVariables: true };
            var saveModel = model.getSaveModelClone(options);
            expect(saveModel.templating.list[0].current.text).toBe('server_002');
        });
    });
    describe('Given model with template variable of type adhoc', function () {
        var model;
        beforeEach(function () {
            var json = {
                templating: {
                    list: [
                        {
                            name: 'Filter',
                            type: 'adhoc',
                            filters: [
                                {
                                    key: '@hostname',
                                    operator: '=',
                                    value: 'server 20',
                                },
                            ],
                        },
                    ],
                },
            };
            model = getDashboardModel(json);
            expect(model.hasVariableValuesChanged()).toBeFalsy();
        });
        it('hasVariableValuesChanged should be false when adding a template variable', function () {
            model.templating.list.push({
                name: 'Filter',
                type: 'adhoc',
                filters: [
                    {
                        key: '@hostname',
                        operator: '=',
                        value: 'server 1',
                    },
                ],
            });
            expect(model.hasVariableValuesChanged()).toBeFalsy();
        });
        it('hasVariableValuesChanged should be false when removing existing template variable', function () {
            model.templating.list = [];
            expect(model.hasVariableValuesChanged()).toBeFalsy();
        });
        it('hasVariableValuesChanged should be true when changing value of filter', function () {
            model.templating.list[0].filters[0].value = 'server 1';
            expect(model.hasVariableValuesChanged()).toBeTruthy();
        });
        it('hasVariableValuesChanged should be true when adding an additional condition', function () {
            model.templating.list[0].filters[0].condition = 'AND';
            model.templating.list[0].filters[1] = {
                key: '@metric',
                operator: '=',
                value: 'logins.count',
            };
            expect(model.hasVariableValuesChanged()).toBeTruthy();
        });
        it('getSaveModelClone should return original variable when saveVariables=false', function () {
            model.templating.list[0].filters[0].value = 'server 1';
            var options = { saveVariables: false };
            var saveModel = model.getSaveModelClone(options);
            expect(saveModel.templating.list[0].filters[0].value).toBe('server 20');
        });
        it('getSaveModelClone should return updated variable when saveVariables=true', function () {
            model.templating.list[0].filters[0].value = 'server 1';
            var options = { saveVariables: true };
            var saveModel = model.getSaveModelClone(options);
            expect(saveModel.templating.list[0].filters[0].value).toBe('server 1');
        });
    });
    describe('Given a dashboard with one panel legend on and two off', function () {
        var model;
        beforeEach(function () {
            var data = {
                panels: [
                    { id: 1, type: 'graph', gridPos: { x: 0, y: 0, w: 24, h: 2 }, legend: { show: true } },
                    { id: 3, type: 'graph', gridPos: { x: 0, y: 4, w: 12, h: 2 }, legend: { show: false } },
                    { id: 4, type: 'graph', gridPos: { x: 12, y: 4, w: 12, h: 2 }, legend: { show: false } },
                ],
            };
            model = new DashboardModel(data);
        });
        it('toggleLegendsForAll should toggle all legends on on first execution', function () {
            model.toggleLegendsForAll();
            var legendsOn = model.panels.filter(function (panel) { return panel.legend.show === true; });
            expect(legendsOn.length).toBe(3);
        });
        it('toggleLegendsForAll should toggle all legends off on second execution', function () {
            model.toggleLegendsForAll();
            model.toggleLegendsForAll();
            var legendsOn = model.panels.filter(function (panel) { return panel.legend.show === true; });
            expect(legendsOn.length).toBe(0);
        });
    });
    describe('canAddAnnotations', function () {
        it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      canEdit  | canMakeEditable | expected\n      ", " | ", "        | ", "\n      ", " | ", "         | ", "\n      ", "  | ", "        | ", "\n      ", "  | ", "         | ", "\n    "], ["\n      canEdit  | canMakeEditable | expected\n      ", " | ", "        | ", "\n      ", " | ", "         | ", "\n      ", "  | ", "        | ", "\n      ", "  | ", "         | ", "\n    "])), false, false, false, false, true, true, true, false, true, true, true, true)('when called with canEdit:{$canEdit}, canMakeEditable:{$canMakeEditable} and expected:{$expected}', function (_a) {
            var canEdit = _a.canEdit, canMakeEditable = _a.canMakeEditable, expected = _a.expected;
            var dashboard = new DashboardModel({});
            dashboard.meta.canEdit = canEdit;
            dashboard.meta.canMakeEditable = canMakeEditable;
            var result = dashboard.canAddAnnotations();
            expect(result).toBe(expected);
        });
    });
    describe('canEditPanel', function () {
        it('returns false if the dashboard cannot be edited', function () {
            var dashboard = new DashboardModel({
                panels: [
                    { id: 1, type: 'row', gridPos: { x: 0, y: 0, w: 24, h: 6 } },
                    { id: 2, type: 'graph', gridPos: { x: 0, y: 7, w: 12, h: 2 } },
                ],
            });
            dashboard.meta.canEdit = false;
            var panel = dashboard.getPanelById(2);
            expect(dashboard.canEditPanel(panel)).toBe(false);
        });
        it('returns false if no panel is passed in', function () {
            var dashboard = new DashboardModel({
                panels: [
                    { id: 1, type: 'row', gridPos: { x: 0, y: 0, w: 24, h: 6 } },
                    { id: 2, type: 'graph', gridPos: { x: 0, y: 7, w: 12, h: 2 } },
                ],
            });
            expect(dashboard.canEditPanel()).toBe(false);
        });
        it('returns false if the panel is a repeat', function () {
            var dashboard = new DashboardModel({
                panels: [
                    { id: 1, type: 'row', gridPos: { x: 0, y: 0, w: 24, h: 6 } },
                    { id: 2, type: 'graph', gridPos: { x: 0, y: 7, w: 12, h: 2 } },
                    { id: 3, type: 'graph', gridPos: { x: 0, y: 7, w: 12, h: 2 }, repeatPanelId: 2 },
                ],
            });
            var panel = dashboard.getPanelById(3);
            expect(dashboard.canEditPanel(panel)).toBe(false);
        });
        it('returns false if the panel is a row', function () {
            var dashboard = new DashboardModel({
                panels: [
                    { id: 1, type: 'row', gridPos: { x: 0, y: 0, w: 24, h: 6 } },
                    { id: 2, type: 'graph', gridPos: { x: 0, y: 7, w: 12, h: 2 } },
                ],
            });
            var panel = dashboard.getPanelById(1);
            expect(dashboard.canEditPanel(panel)).toBe(false);
        });
        it('returns true otherwise', function () {
            var dashboard = new DashboardModel({
                panels: [
                    { id: 1, type: 'row', gridPos: { x: 0, y: 0, w: 24, h: 6 } },
                    { id: 2, type: 'graph', gridPos: { x: 0, y: 7, w: 12, h: 2 } },
                ],
            });
            var panel = dashboard.getPanelById(2);
            expect(dashboard.canEditPanel(panel)).toBe(true);
        });
    });
});
describe('exitViewPanel', function () {
    function getTestContext() {
        var panel = { setIsViewing: jest.fn() };
        var dashboard = new DashboardModel({});
        dashboard.startRefresh = jest.fn();
        dashboard.panelInView = panel;
        return { dashboard: dashboard, panel: panel };
    }
    describe('when called', function () {
        it('then panelInView is set to undefined', function () {
            var _a = getTestContext(), dashboard = _a.dashboard, panel = _a.panel;
            dashboard.exitViewPanel(panel);
            expect(dashboard.panelInView).toBeUndefined();
        });
        it('then setIsViewing is called on panel', function () {
            var _a = getTestContext(), dashboard = _a.dashboard, panel = _a.panel;
            dashboard.exitViewPanel(panel);
            expect(panel.setIsViewing).toHaveBeenCalledWith(false);
        });
        it('then startRefresh is not called', function () {
            var _a = getTestContext(), dashboard = _a.dashboard, panel = _a.panel;
            dashboard.exitViewPanel(panel);
            expect(dashboard.startRefresh).not.toHaveBeenCalled();
        });
        describe('and there is a change that affects all panels', function () {
            it('then startRefresh is not called', function () {
                var _a = getTestContext(), dashboard = _a.dashboard, panel = _a.panel;
                dashboard.setChangeAffectsAllPanels();
                dashboard.exitViewPanel(panel);
                expect(dashboard.startRefresh).toHaveBeenCalled();
            });
        });
    });
});
describe('exitPanelEditor', function () {
    function getTestContext(setPreviousAutoRefresh) {
        if (setPreviousAutoRefresh === void 0) { setPreviousAutoRefresh = false; }
        var panel = { destroy: jest.fn() };
        var dashboard = new DashboardModel({});
        var timeSrvMock = {
            pauseAutoRefresh: jest.fn(),
            resumeAutoRefresh: jest.fn(),
            setAutoRefresh: jest.fn(),
        };
        dashboard.startRefresh = jest.fn();
        dashboard.panelInEdit = panel;
        if (setPreviousAutoRefresh) {
            timeSrvMock.previousAutoRefresh = '5s';
        }
        setTimeSrv(timeSrvMock);
        return { dashboard: dashboard, panel: panel, timeSrvMock: timeSrvMock };
    }
    describe('when called', function () {
        it('then panelInEdit is set to undefined', function () {
            var dashboard = getTestContext().dashboard;
            dashboard.exitPanelEditor();
            expect(dashboard.panelInEdit).toBeUndefined();
        });
        it('then destroy is called on panel', function () {
            var _a = getTestContext(), dashboard = _a.dashboard, panel = _a.panel;
            dashboard.exitPanelEditor();
            expect(panel.destroy).toHaveBeenCalled();
        });
        it('then startRefresh is not called', function () {
            var dashboard = getTestContext().dashboard;
            dashboard.exitPanelEditor();
            expect(dashboard.startRefresh).not.toHaveBeenCalled();
        });
        it('then auto refresh property is resumed', function () {
            var _a = getTestContext(true), dashboard = _a.dashboard, timeSrvMock = _a.timeSrvMock;
            dashboard.exitPanelEditor();
            expect(timeSrvMock.resumeAutoRefresh).toHaveBeenCalled();
        });
        describe('and there is a change that affects all panels', function () {
            it('then startRefresh is called', function () {
                var dashboard = getTestContext().dashboard;
                dashboard.setChangeAffectsAllPanels();
                dashboard.exitPanelEditor();
                expect(dashboard.startRefresh).toHaveBeenCalled();
            });
        });
    });
});
describe('setChangeAffectsAllPanels', function () {
    it.each(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    panelInEdit  | panelInView  | expected\n    ", "      | ", "      | ", "\n    ", " | ", " | ", "\n    ", "      | ", "        | ", "\n    ", " | ", "        | ", "\n    ", "        | ", "      | ", "\n    ", "        | ", " | ", "\n    ", "        | ", "        | ", "\n  "], ["\n    panelInEdit  | panelInView  | expected\n    ", "      | ", "      | ", "\n    ", " | ", " | ", "\n    ", "      | ", "        | ", "\n    ", " | ", "        | ", "\n    ", "        | ", "      | ", "\n    ", "        | ", " | ", "\n    ", "        | ", "        | ", "\n  "])), null, null, false, undefined, undefined, false, null, {}, true, undefined, {}, true, {}, null, true, {}, undefined, true, {}, {}, true)('when called and panelInEdit:{$panelInEdit} and panelInView:{$panelInView}', function (_a) {
        var panelInEdit = _a.panelInEdit, panelInView = _a.panelInView, expected = _a.expected;
        var dashboard = new DashboardModel({});
        dashboard.panelInEdit = panelInEdit;
        dashboard.panelInView = panelInView;
        dashboard.setChangeAffectsAllPanels();
        expect(dashboard['hasChangesThatAffectsAllPanels']).toEqual(expected);
    });
});
describe('initEditPanel', function () {
    function getTestContext() {
        var dashboard = new DashboardModel({});
        var timeSrvMock = {
            pauseAutoRefresh: jest.fn(),
            resumeAutoRefresh: jest.fn(),
        };
        setTimeSrv(timeSrvMock);
        return { dashboard: dashboard, timeSrvMock: timeSrvMock };
    }
    describe('when called', function () {
        it('then panelInEdit is not undefined', function () {
            var dashboard = getTestContext().dashboard;
            dashboard.addPanel({ type: 'timeseries' });
            dashboard.initEditPanel(dashboard.panels[0]);
            expect(dashboard.panelInEdit).not.toBeUndefined();
        });
        it('then auto-refresh is paused', function () {
            var _a = getTestContext(), dashboard = _a.dashboard, timeSrvMock = _a.timeSrvMock;
            dashboard.addPanel({ type: 'timeseries' });
            dashboard.initEditPanel(dashboard.panels[0]);
            expect(timeSrvMock.pauseAutoRefresh).toHaveBeenCalled();
        });
    });
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=DashboardModel.test.js.map