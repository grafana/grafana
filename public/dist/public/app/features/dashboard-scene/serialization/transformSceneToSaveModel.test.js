import { __awaiter } from "tslib";
import { advanceTo } from 'jest-date-mock';
import { map, of } from 'rxjs';
import { dateTime, FieldType, standardTransformersRegistry, toDataFrame, VariableSupportType, } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel, } from '@grafana/scenes';
import { LoadingState, VariableRefresh } from '@grafana/schema';
import { PanelModel } from 'app/features/dashboard/state';
import { getTimeRange } from 'app/features/dashboard/utils/timeRange';
import { reduceTransformRegistryItem } from 'app/features/transformers/editors/ReduceTransformerEditor';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';
import { activateFullSceneTree } from '../utils/test-utils';
import { getVizPanelKeyForPanelId } from '../utils/utils';
import { GRAFANA_DATASOURCE_REF } from './const';
import dashboard_to_load1 from './testfiles/dashboard_to_load1.json';
import repeatingRowsAndPanelsDashboardJson from './testfiles/repeating_rows_and_panels.json';
import snapshotableDashboardJson from './testfiles/snapshotable_dashboard.json';
import snapshotableWithRowsDashboardJson from './testfiles/snapshotable_with_rows.json';
import { buildGridItemForLibPanel, buildGridItemForPanel, transformSaveModelToScene, } from './transformSaveModelToScene';
import { gridItemToPanel, transformSceneToSaveModel, trimDashboardForSnapshot } from './transformSceneToSaveModel';
standardTransformersRegistry.setInit(() => [reduceTransformRegistryItem]);
setPluginImportUtils({
    importPanelPlugin: (id) => Promise.resolve(getPanelPlugin({})),
    getPanelPluginFromCache: (id) => undefined,
});
const AFrame = toDataFrame({
    name: 'A',
    fields: [
        { name: 'time', type: FieldType.time, values: [100, 200, 300] },
        { name: 'values', type: FieldType.number, values: [1, 2, 3] },
    ],
});
const BFrame = toDataFrame({
    name: 'B',
    fields: [
        { name: 'time', type: FieldType.time, values: [100, 200, 300] },
        { name: 'values', type: FieldType.number, values: [10, 20, 30] },
    ],
});
const CFrame = toDataFrame({
    name: 'C',
    fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
        { name: 'values', type: FieldType.number, values: [100, 200, 300] },
    ],
});
const AnnoFrame = toDataFrame({
    fields: [
        { name: 'time', values: [1, 2, 2, 5, 5] },
        { name: 'id', values: ['1', '2', '2', '5', '5'] },
        { name: 'text', values: ['t1', 't2', 't3', 't4', 't5'] },
    ],
});
const VariableQueryFrame = toDataFrame({
    fields: [{ name: 'text', type: FieldType.string, values: ['val1', 'val2', 'val11'] }],
});
const testSeries = {
    A: AFrame,
    B: BFrame,
    C: CFrame,
    Anno: AnnoFrame,
    VariableQuery: VariableQueryFrame,
};
const runRequestMock = jest.fn().mockImplementation((ds, request) => {
    const result = {
        state: LoadingState.Loading,
        series: [],
        timeRange: request.range,
    };
    return of([]).pipe(map(() => {
        result.state = LoadingState.Done;
        const refId = request.targets[0].refId;
        result.series = [testSeries[refId]];
        return result;
    }));
});
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getDataSourceSrv: () => ({
        get: () => ({
            getRef: () => ({ type: 'mock-ds', uid: 'mock-uid' }),
            variables: {
                getType: () => VariableSupportType.Standard,
                toDataQuery: (q) => q,
            },
        }),
    }), getRunRequest: () => (ds, request) => {
        return runRequestMock(ds, request);
    }, config: {
        panels: [],
        theme2: {
            visualization: {
                getColorByName: jest.fn().mockReturnValue('red'),
            },
        },
    } })));
describe('transformSceneToSaveModel', () => {
    describe('Given a simple scene with variables', () => {
        it('Should transform back to persisted model', () => {
            const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1, meta: {} });
            const saveModel = transformSceneToSaveModel(scene);
            expect(saveModel).toMatchSnapshot();
        });
    });
    describe('Given a scene with rows', () => {
        it('Should transform back to persisted model', () => {
            const scene = transformSaveModelToScene({ dashboard: repeatingRowsAndPanelsDashboardJson, meta: {} });
            const saveModel = transformSceneToSaveModel(scene);
            const row2 = saveModel.panels[2];
            expect(row2.type).toBe('row');
            expect(row2.repeat).toBe('server');
            expect(saveModel).toMatchSnapshot();
        });
        it('Should remove repeated rows in save model', () => {
            var _a, _b;
            const scene = transformSaveModelToScene({ dashboard: repeatingRowsAndPanelsDashboardJson, meta: {} });
            const variable = (_a = scene.state.$variables) === null || _a === void 0 ? void 0 : _a.state.variables[0];
            variable.changeValueTo(['a', 'b', 'c']);
            const grid = scene.state.body;
            const rowWithRepeat = grid.state.children[1];
            const rowRepeater = rowWithRepeat.state.$behaviors[0];
            // trigger row repeater
            (_b = rowRepeater.variableDependency) === null || _b === void 0 ? void 0 : _b.variableUpdatesCompleted(new Set([variable]));
            // Make sure the repeated rows have been added to runtime scene model
            expect(grid.state.children.length).toBe(5);
            const saveModel = transformSceneToSaveModel(scene);
            const rows = saveModel.panels.filter((p) => p.type === 'row');
            // Verify the save model does not contain any repeated rows
            expect(rows.length).toBe(3);
        });
    });
    describe('Panel options', () => {
        it('Given panel with time override', () => {
            const gridItem = buildGridItemFromPanelSchema({
                timeFrom: '2h',
                timeShift: '1d',
                hideTimeOverride: true,
            });
            const saveModel = gridItemToPanel(gridItem);
            expect(saveModel.timeFrom).toBe('2h');
            expect(saveModel.timeShift).toBe('1d');
            expect(saveModel.hideTimeOverride).toBe(true);
        });
        it('transparent panel', () => {
            const gridItem = buildGridItemFromPanelSchema({ transparent: true });
            const saveModel = gridItemToPanel(gridItem);
            expect(saveModel.transparent).toBe(true);
        });
        it('Given panel with repeat', () => {
            var _a, _b, _c, _d;
            const gridItem = buildGridItemFromPanelSchema({
                title: '',
                type: 'text-plugin-34',
                gridPos: { x: 1, y: 2, w: 12, h: 8 },
                repeat: 'server',
                repeatDirection: 'v',
                maxPerRow: 8,
            });
            const saveModel = gridItemToPanel(gridItem);
            expect(saveModel.repeat).toBe('server');
            expect(saveModel.repeatDirection).toBe('v');
            expect(saveModel.maxPerRow).toBe(8);
            expect((_a = saveModel.gridPos) === null || _a === void 0 ? void 0 : _a.x).toBe(1);
            expect((_b = saveModel.gridPos) === null || _b === void 0 ? void 0 : _b.y).toBe(2);
            expect((_c = saveModel.gridPos) === null || _c === void 0 ? void 0 : _c.w).toBe(12);
            expect((_d = saveModel.gridPos) === null || _d === void 0 ? void 0 : _d.h).toBe(8);
        });
    });
    describe('Library panels', () => {
        it('given a library panel', () => {
            const panel = buildGridItemFromPanelSchema({
                id: 4,
                gridPos: {
                    h: 8,
                    w: 12,
                    x: 0,
                    y: 0,
                },
                libraryPanel: {
                    name: 'Some lib panel panel',
                    uid: 'lib-panel-uid',
                },
                title: 'A panel',
                transformations: [],
                fieldConfig: {
                    defaults: {},
                    overrides: [],
                },
            });
            const result = gridItemToPanel(panel);
            expect(result.id).toBe(4);
            expect(result.libraryPanel).toEqual({
                name: 'Some lib panel panel',
                uid: 'lib-panel-uid',
            });
            expect(result.gridPos).toEqual({
                h: 8,
                w: 12,
                x: 0,
                y: 0,
            });
            expect(result.title).toBe('A panel');
            expect(result.transformations).toBeUndefined();
            expect(result.fieldConfig).toBeUndefined();
        });
    });
    describe('Annotations', () => {
        it('should transform annotations to save model', () => {
            var _a, _b, _c;
            const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1, meta: {} });
            const saveModel = transformSceneToSaveModel(scene);
            expect((_b = (_a = saveModel.annotations) === null || _a === void 0 ? void 0 : _a.list) === null || _b === void 0 ? void 0 : _b.length).toBe(4);
            expect((_c = saveModel.annotations) === null || _c === void 0 ? void 0 : _c.list).toMatchSnapshot();
        });
        it('should transform annotations to save model after state changes', () => {
            var _a, _b, _c, _d, _e, _f, _g;
            const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1, meta: {} });
            const layers = (_a = scene.state.$data) === null || _a === void 0 ? void 0 : _a.state.layers;
            const enabledLayer = layers[1];
            const hiddenLayer = layers[3];
            enabledLayer.setState({
                isEnabled: false,
            });
            hiddenLayer.setState({
                isHidden: false,
            });
            const saveModel = transformSceneToSaveModel(scene);
            expect((_c = (_b = saveModel.annotations) === null || _b === void 0 ? void 0 : _b.list) === null || _c === void 0 ? void 0 : _c.length).toBe(4);
            expect((_e = (_d = saveModel.annotations) === null || _d === void 0 ? void 0 : _d.list) === null || _e === void 0 ? void 0 : _e[1].enable).toEqual(false);
            expect((_g = (_f = saveModel.annotations) === null || _f === void 0 ? void 0 : _f.list) === null || _g === void 0 ? void 0 : _g[3].hide).toEqual(false);
        });
    });
    describe('Queries', () => {
        it('Given panel with queries', () => {
            var _a, _b;
            const panel = buildGridItemFromPanelSchema({
                datasource: {
                    type: 'grafana-testdata',
                    uid: 'abc',
                },
                maxDataPoints: 100,
                targets: [
                    {
                        refId: 'A',
                        expr: 'A',
                        datasource: {
                            type: 'grafana-testdata',
                            uid: 'abc',
                        },
                    },
                    {
                        refId: 'B',
                        expr: 'B',
                    },
                ],
            });
            const result = gridItemToPanel(panel);
            expect(result.maxDataPoints).toBe(100);
            expect((_a = result.targets) === null || _a === void 0 ? void 0 : _a.length).toBe(2);
            expect((_b = result.targets) === null || _b === void 0 ? void 0 : _b[0]).toEqual({
                refId: 'A',
                expr: 'A',
                datasource: {
                    type: 'grafana-testdata',
                    uid: 'abc',
                },
            });
            expect(result.datasource).toEqual({
                type: 'grafana-testdata',
                uid: 'abc',
            });
        });
        it('Given panel with transformations', () => {
            var _a, _b, _c;
            const panel = buildGridItemFromPanelSchema({
                datasource: {
                    type: 'grafana-testdata',
                    uid: 'abc',
                },
                maxDataPoints: 100,
                transformations: [
                    {
                        id: 'reduce',
                        options: {
                            reducers: ['max'],
                            mode: 'reduceFields',
                            includeTimeField: false,
                        },
                    },
                ],
                targets: [
                    {
                        refId: 'A',
                        expr: 'A',
                        datasource: {
                            type: 'grafana-testdata',
                            uid: 'abc',
                        },
                    },
                    {
                        refId: 'B',
                        expr: 'B',
                    },
                ],
            });
            const result = gridItemToPanel(panel);
            expect((_a = result.transformations) === null || _a === void 0 ? void 0 : _a.length).toBe(1);
            expect(result.maxDataPoints).toBe(100);
            expect((_b = result.targets) === null || _b === void 0 ? void 0 : _b.length).toBe(2);
            expect((_c = result.targets) === null || _c === void 0 ? void 0 : _c[0]).toEqual({
                refId: 'A',
                expr: 'A',
                datasource: {
                    type: 'grafana-testdata',
                    uid: 'abc',
                },
            });
            expect(result.datasource).toEqual({
                type: 'grafana-testdata',
                uid: 'abc',
            });
        });
        it('Given panel with shared query', () => {
            var _a, _b;
            const panel = buildGridItemFromPanelSchema({
                datasource: {
                    type: 'datasource',
                    uid: SHARED_DASHBOARD_QUERY,
                },
                targets: [
                    {
                        refId: 'A',
                        panelId: 1,
                        datasource: {
                            type: 'datasource',
                            uid: SHARED_DASHBOARD_QUERY,
                        },
                    },
                ],
            });
            const result = gridItemToPanel(panel);
            expect((_a = result.targets) === null || _a === void 0 ? void 0 : _a.length).toBe(1);
            expect((_b = result.targets) === null || _b === void 0 ? void 0 : _b[0]).toEqual({
                refId: 'A',
                panelId: 1,
                datasource: {
                    type: 'datasource',
                    uid: SHARED_DASHBOARD_QUERY,
                },
            });
            expect(result.datasource).toEqual({
                type: 'datasource',
                uid: SHARED_DASHBOARD_QUERY,
            });
        });
        it('Given panel with shared query and transformations', () => {
            var _a, _b, _c;
            const panel = buildGridItemFromPanelSchema({
                datasource: {
                    type: 'datasource',
                    uid: SHARED_DASHBOARD_QUERY,
                },
                targets: [
                    {
                        refId: 'A',
                        panelId: 1,
                        datasource: {
                            type: 'datasource',
                            uid: SHARED_DASHBOARD_QUERY,
                        },
                    },
                ],
                transformations: [
                    {
                        id: 'reduce',
                        options: {
                            reducers: ['max'],
                            mode: 'reduceFields',
                            includeTimeField: false,
                        },
                    },
                ],
            });
            const result = gridItemToPanel(panel);
            expect((_a = result.transformations) === null || _a === void 0 ? void 0 : _a.length).toBe(1);
            expect((_b = result.targets) === null || _b === void 0 ? void 0 : _b.length).toBe(1);
            expect((_c = result.targets) === null || _c === void 0 ? void 0 : _c[0]).toEqual({
                refId: 'A',
                panelId: 1,
                datasource: {
                    type: 'datasource',
                    uid: SHARED_DASHBOARD_QUERY,
                },
            });
            expect(result.datasource).toEqual({
                type: 'datasource',
                uid: SHARED_DASHBOARD_QUERY,
            });
        });
    });
    describe('Snapshots', () => {
        const fakeCurrentDate = dateTime('2023-01-01T20:00:00.000Z').toDate();
        beforeEach(() => {
            advanceTo(fakeCurrentDate);
        });
        it('attaches snapshot data to panels using Grafana snapshot query', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
            const scene = transformSaveModelToScene({ dashboard: snapshotableDashboardJson, meta: {} });
            activateFullSceneTree(scene);
            yield new Promise((r) => setTimeout(r, 1));
            const snapshot = transformSceneToSaveModel(scene, true);
            expect((_a = snapshot.panels) === null || _a === void 0 ? void 0 : _a.length).toBe(3);
            // Regular panel with SceneQueryRunner
            // @ts-expect-error
            expect((_b = snapshot.panels) === null || _b === void 0 ? void 0 : _b[0].datasource).toEqual(GRAFANA_DATASOURCE_REF);
            // @ts-expect-error
            expect((_d = (_c = snapshot.panels) === null || _c === void 0 ? void 0 : _c[0].targets) === null || _d === void 0 ? void 0 : _d[0].datasource).toEqual(GRAFANA_DATASOURCE_REF);
            // @ts-expect-error
            expect((_f = (_e = snapshot.panels) === null || _e === void 0 ? void 0 : _e[0].targets) === null || _f === void 0 ? void 0 : _f[0].snapshot[0].data).toEqual({
                values: [
                    [100, 200, 300],
                    [1, 2, 3],
                ],
            });
            // Panel with transformations
            // @ts-expect-error
            expect((_g = snapshot.panels) === null || _g === void 0 ? void 0 : _g[1].datasource).toEqual(GRAFANA_DATASOURCE_REF);
            // @ts-expect-error
            expect((_j = (_h = snapshot.panels) === null || _h === void 0 ? void 0 : _h[1].targets) === null || _j === void 0 ? void 0 : _j[0].datasource).toEqual(GRAFANA_DATASOURCE_REF);
            // @ts-expect-error
            expect((_l = (_k = snapshot.panels) === null || _k === void 0 ? void 0 : _k[1].targets) === null || _l === void 0 ? void 0 : _l[0].snapshot[0].data).toEqual({
                values: [
                    [100, 200, 300],
                    [10, 20, 30],
                ],
            });
            // @ts-expect-error
            expect((_m = snapshot.panels) === null || _m === void 0 ? void 0 : _m[1].transformations).toEqual([
                {
                    id: 'reduce',
                    options: {},
                },
            ]);
            // Panel with a shared query (dahsboard query)
            // @ts-expect-error
            expect((_o = snapshot.panels) === null || _o === void 0 ? void 0 : _o[2].datasource).toEqual(GRAFANA_DATASOURCE_REF);
            // @ts-expect-error
            expect((_q = (_p = snapshot.panels) === null || _p === void 0 ? void 0 : _p[2].targets) === null || _q === void 0 ? void 0 : _q[0].datasource).toEqual(GRAFANA_DATASOURCE_REF);
            // @ts-expect-error
            expect((_s = (_r = snapshot.panels) === null || _r === void 0 ? void 0 : _r[2].targets) === null || _s === void 0 ? void 0 : _s[0].snapshot[0].data).toEqual({
                values: [
                    [100, 200, 300],
                    [1, 2, 3],
                ],
            });
        }));
        it('handles basic rows', () => __awaiter(void 0, void 0, void 0, function* () {
            var _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11;
            const scene = transformSaveModelToScene({ dashboard: snapshotableWithRowsDashboardJson, meta: {} });
            activateFullSceneTree(scene);
            yield new Promise((r) => setTimeout(r, 1));
            const snapshot = transformSceneToSaveModel(scene, true);
            expect((_t = snapshot.panels) === null || _t === void 0 ? void 0 : _t.length).toBe(5);
            // @ts-expect-error
            expect((_v = (_u = snapshot.panels) === null || _u === void 0 ? void 0 : _u[0].targets) === null || _v === void 0 ? void 0 : _v[0].datasource).toEqual(GRAFANA_DATASOURCE_REF);
            // @ts-expect-error
            expect((_x = (_w = snapshot.panels) === null || _w === void 0 ? void 0 : _w[0].targets) === null || _x === void 0 ? void 0 : _x[0].snapshot[0].data).toEqual({
                values: [
                    [100, 200, 300],
                    [1, 2, 3],
                ],
            });
            // @ts-expect-error
            expect((_y = snapshot.panels) === null || _y === void 0 ? void 0 : _y[1].targets).toBeUndefined();
            // @ts-expect-error
            expect((_z = snapshot.panels) === null || _z === void 0 ? void 0 : _z[1].panels).toEqual([]);
            // @ts-expect-error
            expect((_0 = snapshot.panels) === null || _0 === void 0 ? void 0 : _0[1].collapsed).toEqual(false);
            // @ts-expect-error
            expect((_2 = (_1 = snapshot.panels) === null || _1 === void 0 ? void 0 : _1[2].targets) === null || _2 === void 0 ? void 0 : _2[0].datasource).toEqual(GRAFANA_DATASOURCE_REF);
            // @ts-expect-error
            expect((_4 = (_3 = snapshot.panels) === null || _3 === void 0 ? void 0 : _3[2].targets) === null || _4 === void 0 ? void 0 : _4[0].snapshot[0].data).toEqual({
                values: [
                    [100, 200, 300],
                    [10, 20, 30],
                ],
            });
            // @ts-expect-error
            expect((_6 = (_5 = snapshot.panels) === null || _5 === void 0 ? void 0 : _5[3].targets) === null || _6 === void 0 ? void 0 : _6[0].datasource).toEqual(GRAFANA_DATASOURCE_REF);
            // @ts-expect-error
            expect((_8 = (_7 = snapshot.panels) === null || _7 === void 0 ? void 0 : _7[3].targets) === null || _8 === void 0 ? void 0 : _8[0].snapshot[0].data).toEqual({
                values: [
                    [1000, 2000, 3000],
                    [100, 200, 300],
                ],
            });
            // @ts-expect-error
            expect((_9 = snapshot.panels) === null || _9 === void 0 ? void 0 : _9[4].targets).toBeUndefined();
            // @ts-expect-error
            expect((_10 = snapshot.panels) === null || _10 === void 0 ? void 0 : _10[4].panels).toHaveLength(1);
            // @ts-expect-error
            expect((_11 = snapshot.panels) === null || _11 === void 0 ? void 0 : _11[4].collapsed).toEqual(true);
        }));
        describe('trimDashboardForSnapshot', () => {
            let snapshot = {};
            beforeEach(() => {
                const scene = transformSaveModelToScene({ dashboard: snapshotableDashboardJson, meta: {} });
                activateFullSceneTree(scene);
                snapshot = transformSceneToSaveModel(scene, true);
            });
            it('should not mutate provided dashboard', () => {
                const result = trimDashboardForSnapshot('Snap title', getTimeRange({ from: 'now-6h', to: 'now' }), snapshot);
                expect(result).not.toBe(snapshot);
            });
            it('should apply provided title and absolute time range', () => __awaiter(void 0, void 0, void 0, function* () {
                const result = trimDashboardForSnapshot('Snap title', getTimeRange({ from: 'now-6h', to: 'now' }), snapshot);
                expect(result.title).toBe('Snap title');
                expect(result.time).toBeDefined();
                expect(result.time.from).toEqual('2023-01-01T14:00:00.000Z');
                expect(result.time.to).toEqual('2023-01-01T20:00:00.000Z');
            }));
            it('should remove queries from annotations and attach empty snapshotData', () => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
                expect((_b = (_a = snapshot.annotations) === null || _a === void 0 ? void 0 : _a.list) === null || _b === void 0 ? void 0 : _b[0].target).toBeDefined();
                expect((_d = (_c = snapshot.annotations) === null || _c === void 0 ? void 0 : _c.list) === null || _d === void 0 ? void 0 : _d[1].target).toBeDefined();
                const result = trimDashboardForSnapshot('Snap title', getTimeRange({ from: 'now-6h', to: 'now' }), snapshot);
                expect((_f = (_e = result.annotations) === null || _e === void 0 ? void 0 : _e.list) === null || _f === void 0 ? void 0 : _f.length).toBe(2);
                expect((_h = (_g = result.annotations) === null || _g === void 0 ? void 0 : _g.list) === null || _h === void 0 ? void 0 : _h[0].target).toBeUndefined();
                expect((_k = (_j = result.annotations) === null || _j === void 0 ? void 0 : _j.list) === null || _k === void 0 ? void 0 : _k[0].snapshotData).toEqual([]);
                expect((_m = (_l = result.annotations) === null || _l === void 0 ? void 0 : _l.list) === null || _m === void 0 ? void 0 : _m[1].target).toBeUndefined();
                expect((_p = (_o = result.annotations) === null || _o === void 0 ? void 0 : _o.list) === null || _p === void 0 ? void 0 : _p[1].snapshotData).toEqual([]);
            });
            it('should remove queries from variables', () => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
                expect((_b = (_a = snapshot.templating) === null || _a === void 0 ? void 0 : _a.list) === null || _b === void 0 ? void 0 : _b.length).toBe(1);
                const result = trimDashboardForSnapshot('Snap title', getTimeRange({ from: 'now-6h', to: 'now' }), snapshot);
                expect((_d = (_c = result.templating) === null || _c === void 0 ? void 0 : _c.list) === null || _d === void 0 ? void 0 : _d.length).toBe(1);
                expect((_f = (_e = result.templating) === null || _e === void 0 ? void 0 : _e.list) === null || _f === void 0 ? void 0 : _f[0].query).toBe('');
                expect((_h = (_g = result.templating) === null || _g === void 0 ? void 0 : _g.list) === null || _h === void 0 ? void 0 : _h[0].refresh).toBe(VariableRefresh.never);
                expect((_k = (_j = result.templating) === null || _j === void 0 ? void 0 : _j.list) === null || _k === void 0 ? void 0 : _k[0].options).toHaveLength(1);
                expect((_o = (_m = (_l = result.templating) === null || _l === void 0 ? void 0 : _l.list) === null || _m === void 0 ? void 0 : _m[0].options) === null || _o === void 0 ? void 0 : _o[0]).toEqual({
                    text: 'annotations',
                    value: 'annotations',
                });
            });
            it('should snapshot a single panel when provided', () => {
                var _a, _b, _c;
                const vizPanel = new VizPanel({
                    key: getVizPanelKeyForPanelId(2),
                });
                const result = trimDashboardForSnapshot('Snap title', getTimeRange({ from: 'now-6h', to: 'now' }), snapshot, vizPanel);
                expect((_a = snapshot.panels) === null || _a === void 0 ? void 0 : _a.length).toBe(3);
                expect((_b = result.panels) === null || _b === void 0 ? void 0 : _b.length).toBe(1);
                // @ts-expect-error
                expect((_c = result.panels) === null || _c === void 0 ? void 0 : _c[0].gridPos).toEqual({ w: 24, x: 0, y: 0, h: 20 });
            });
            // TODO: Uncomment when we support links
            // it('should remove links', async () => {
            //   const scene = transformSaveModelToScene({ dashboard: snapshotableDashboardJson as any, meta: {} });
            //   activateFullSceneTree(scene);
            //   const snapshot = transformSceneToSaveModel(scene, true);
            //   expect(snapshot.links?.length).toBe(1);
            //   const result = trimDashboardForSnapshot('Snap title', getTimeRange({ from: 'now-6h', to: 'now' }), snapshot);
            //   expect(result.links?.length).toBe(0);
            // });
        });
    });
});
export function buildGridItemFromPanelSchema(panel) {
    if (panel.libraryPanel) {
        return buildGridItemForLibPanel(new PanelModel(panel));
    }
    return buildGridItemForPanel(new PanelModel(panel));
}
//# sourceMappingURL=transformSceneToSaveModel.test.js.map