import { __awaiter } from "tslib";
import { thunkTester } from 'test/core/thunk/thunkTester';
import { ThresholdsMode } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { defaultDashboard, FieldColorModeId } from '@grafana/schema';
import { getLibraryPanel } from 'app/features/library-panels/state/api';
import { PanelModel } from '../../dashboard/state';
import { validateDashboardJson } from '../utils/validation';
import { getLibraryPanelInputs, importDashboard, processDashboard } from './actions';
import { initialImportDashboardState, InputType } from './reducers';
jest.mock('app/features/library-panels/state/api');
const mocks = {
    getLibraryPanel: jest.mocked(getLibraryPanel),
};
describe('importDashboard', () => {
    it('Should send data source uid', () => __awaiter(void 0, void 0, void 0, function* () {
        const form = {
            title: 'Asda',
            uid: '12',
            gnetId: 'asd',
            constants: [],
            dataSources: [
                {
                    id: 1,
                    uid: 'ds-uid',
                    name: 'ds-name',
                    type: 'prometheus',
                },
            ],
            elements: [],
            folder: {
                uid: '5v6e5VH4z',
                title: 'title',
            },
        };
        let postArgs;
        setBackendSrv({
            post: (url, args) => {
                postArgs = args;
                return Promise.resolve({
                    importedUrl: '/my/dashboard',
                });
            },
        });
        yield thunkTester({
            importDashboard: Object.assign(Object.assign({}, initialImportDashboardState), { inputs: {
                    dataSources: [
                        {
                            name: 'ds-name',
                            pluginId: 'prometheus',
                            type: InputType.DataSource,
                        },
                    ],
                    constants: [],
                    libraryPanels: [],
                } }),
        })
            .givenThunk(importDashboard)
            .whenThunkIsDispatched(form);
        expect(postArgs).toEqual({
            dashboard: {
                title: 'Asda',
                uid: '12',
            },
            folderUid: '5v6e5VH4z',
            inputs: [
                {
                    name: 'ds-name',
                    pluginId: 'prometheus',
                    type: 'datasource',
                    value: 'ds-uid',
                },
            ],
            overwrite: true,
        });
    }));
});
describe('validateDashboardJson', () => {
    it('Should return true if correct json', () => __awaiter(void 0, void 0, void 0, function* () {
        const jsonImportCorrectFormat = '{"title": "Correct Format", "tags": ["tag1", "tag2"], "schemaVersion": 36}';
        const validateDashboardJsonCorrectFormat = yield validateDashboardJson(jsonImportCorrectFormat);
        expect(validateDashboardJsonCorrectFormat).toBe(true);
    }));
    it('Should not return true if nested tags', () => __awaiter(void 0, void 0, void 0, function* () {
        const jsonImportNestedTags = '{"title": "Nested tags","tags": ["tag1", "tag2", ["nestedTag1", "nestedTag2"]],"schemaVersion": 36}';
        const validateDashboardJsonNestedTags = yield validateDashboardJson(jsonImportNestedTags);
        expect(validateDashboardJsonNestedTags).toBe('tags expected array of strings');
    }));
    it('Should not return true if not an array', () => __awaiter(void 0, void 0, void 0, function* () {
        const jsonImportNotArray = '{"title": "Not Array","tags": "tag1","schemaVersion":36}';
        const validateDashboardJsonNotArray = yield validateDashboardJson(jsonImportNotArray);
        expect(validateDashboardJsonNotArray).toBe('tags expected array');
    }));
    it('Should not return true if not an array and is blank string', () => __awaiter(void 0, void 0, void 0, function* () {
        const jsonImportEmptyTags = '{"schemaVersion": 36,"tags": "", "title": "Empty Tags"}';
        const validateDashboardJsonEmptyTags = yield validateDashboardJson(jsonImportEmptyTags);
        expect(validateDashboardJsonEmptyTags).toBe('tags expected array');
    }));
    it('Should not return true if not valid JSON', () => __awaiter(void 0, void 0, void 0, function* () {
        const jsonImportInvalidJson = '{"schemaVersion": 36,"tags": {"tag", "nested tag"}, "title": "Nested lists"}';
        const validateDashboardJsonNotValid = yield validateDashboardJson(jsonImportInvalidJson);
        expect(validateDashboardJsonNotValid).toBe('Not valid JSON');
    }));
});
describe('processDashboard', () => {
    const panel = new PanelModel({
        datasource: {
            type: 'mysql',
            uid: '${DS_GDEV-MYSQL}',
        },
    });
    const panelWithLibPanel = {
        gridPos: {
            h: 8,
            w: 12,
            x: 0,
            y: 8,
        },
        id: 3,
        libraryPanel: {
            uid: 'a0379b21-fa20-4313-bf12-d7fd7ceb6f90',
            name: 'another prom lib panel',
        },
    };
    const libPanel = {
        'a0379b21-fa20-4313-bf12-d7fd7ceb6f90': {
            name: 'another prom lib panel',
            uid: 'a0379b21-fa20-4313-bf12-d7fd7ceb6f90',
            kind: 1,
            model: {
                datasource: {
                    type: 'prometheus',
                    uid: '${DS_GDEV-PROMETHEUS-FOR-LIBRARY-PANEL}',
                },
                description: '',
                fieldConfig: {
                    defaults: {
                        color: {
                            mode: 'palette-classic',
                        },
                        custom: {
                            axisCenteredZero: false,
                            axisColorMode: 'text',
                            axisLabel: '',
                            axisPlacement: 'auto',
                            barAlignment: 0,
                            drawStyle: 'line',
                            fillOpacity: 0,
                            gradientMode: 'none',
                            hideFrom: {
                                legend: false,
                                tooltip: false,
                                viz: false,
                            },
                            lineInterpolation: 'linear',
                            lineWidth: 1,
                            pointSize: 5,
                            scaleDistribution: {
                                type: 'linear',
                            },
                            showPoints: 'auto',
                            spanNulls: false,
                            stacking: {
                                group: 'A',
                                mode: 'none',
                            },
                            thresholdsStyle: {
                                mode: 'off',
                            },
                        },
                        mappings: [],
                        thresholds: {
                            mode: 'absolute',
                            steps: [
                                {
                                    color: 'green',
                                    value: null,
                                },
                                {
                                    color: 'red',
                                    value: 80,
                                },
                            ],
                        },
                    },
                    overrides: [],
                },
                libraryPanel: {
                    name: 'another prom lib panel',
                    uid: 'a0379b21-fa20-4313-bf12-d7fd7ceb6f90',
                },
                options: {
                    legend: {
                        calcs: [],
                        displayMode: 'list',
                        placement: 'bottom',
                        showLegend: true,
                    },
                    tooltip: {
                        mode: 'single',
                        sort: 'none',
                    },
                },
                targets: [
                    {
                        datasource: {
                            type: 'prometheus',
                            uid: 'gdev-prometheus',
                        },
                        editorMode: 'builder',
                        expr: 'access_evaluation_duration_bucket',
                        instant: false,
                        range: true,
                        refId: 'A',
                    },
                ],
                title: 'Panel Title',
                type: 'timeseries',
            },
        },
    };
    const panelWithSecondLibPanel = {
        gridPos: {
            h: 8,
            w: 12,
            x: 0,
            y: 16,
        },
        id: 1,
        libraryPanel: {
            uid: 'c46a6b49-de40-43b3-982c-1b5e1ec084a4',
            name: 'Testing lib panel',
        },
    };
    const secondLibPanel = {
        'c46a6b49-de40-43b3-982c-1b5e1ec084a4': {
            name: 'Testing lib panel',
            uid: 'c46a6b49-de40-43b3-982c-1b5e1ec084a4',
            kind: 1,
            model: {
                datasource: {
                    type: 'prometheus',
                    uid: '${DS_GDEV-PROMETHEUS-FOR-LIBRARY-PANEL}',
                },
                description: '',
                fieldConfig: {
                    defaults: {
                        color: {
                            mode: 'palette-classic',
                        },
                        custom: {
                            axisCenteredZero: false,
                            axisColorMode: 'text',
                            axisLabel: '',
                            axisPlacement: 'auto',
                            barAlignment: 0,
                            drawStyle: 'line',
                            fillOpacity: 0,
                            gradientMode: 'none',
                            hideFrom: {
                                legend: false,
                                tooltip: false,
                                viz: false,
                            },
                            lineInterpolation: 'linear',
                            lineWidth: 1,
                            pointSize: 5,
                            scaleDistribution: {
                                type: 'linear',
                            },
                            showPoints: 'auto',
                            spanNulls: false,
                            stacking: {
                                group: 'A',
                                mode: 'none',
                            },
                            thresholdsStyle: {
                                mode: 'off',
                            },
                        },
                        mappings: [],
                        thresholds: {
                            mode: 'absolute',
                            steps: [
                                {
                                    color: 'green',
                                    value: null,
                                },
                                {
                                    color: 'red',
                                    value: 80,
                                },
                            ],
                        },
                    },
                    overrides: [],
                },
                libraryPanel: {
                    name: 'Testing lib panel',
                    uid: 'c46a6b49-de40-43b3-982c-1b5e1ec084a4',
                },
                options: {
                    legend: {
                        calcs: [],
                        displayMode: 'list',
                        placement: 'bottom',
                        showLegend: true,
                    },
                    tooltip: {
                        mode: 'single',
                        sort: 'none',
                    },
                },
                targets: [
                    {
                        datasource: {
                            type: 'prometheus',
                            uid: 'gdev-prometheus',
                        },
                        editorMode: 'builder',
                        expr: 'access_evaluation_duration_count',
                        instant: false,
                        range: true,
                        refId: 'A',
                    },
                ],
                title: 'Panel Title',
                type: 'timeseries',
            },
        },
    };
    const importedJson = Object.assign(Object.assign({}, defaultDashboard), { __inputs: [
            {
                name: 'DS_GDEV-MYSQL',
                label: 'gdev-mysql',
                description: '',
                type: 'datasource',
                value: '',
            },
            {
                name: 'DS_GDEV-PROMETHEUS-FOR-LIBRARY-PANEL',
                label: 'gdev-prometheus',
                description: '',
                type: 'datasource',
                value: '',
                usage: {
                    libraryPanels: [
                        {
                            name: 'another prom lib panel',
                            uid: 'a0379b21-fa20-4313-bf12-d7fd7ceb6f90',
                        },
                    ],
                },
            },
        ], __elements: Object.assign({}, libPanel), __requires: [
            {
                type: 'grafana',
                id: 'grafana',
                name: 'Grafana',
                version: '10.1.0-pre',
            },
            {
                type: 'datasource',
                id: 'mysql',
                name: 'MySQL',
                version: '1.0.0',
            },
            {
                type: 'datasource',
                id: 'prometheus',
                name: 'Prometheus',
                version: '1.0.0',
            },
            {
                type: 'panel',
                id: 'table',
                name: 'Table',
                version: '',
            },
        ], panels: [] });
    it("Should return 2 inputs, 1 for library panel because it's used for 2 panels", () => __awaiter(void 0, void 0, void 0, function* () {
        mocks.getLibraryPanel.mockImplementation(() => {
            throw { status: 404 };
        });
        const importDashboardState = initialImportDashboardState;
        const dashboardJson = Object.assign(Object.assign({}, importedJson), { panels: [panel, panelWithLibPanel, panelWithLibPanel] });
        const libPanelInputs = yield getLibraryPanelInputs(dashboardJson);
        const newDashboardState = Object.assign(Object.assign({}, importDashboardState), { inputs: Object.assign(Object.assign({}, importDashboardState.inputs), { libraryPanels: libPanelInputs }) });
        const processedDashboard = processDashboard(dashboardJson, newDashboardState);
        const dsInputsForLibPanels = processedDashboard.__inputs.filter((input) => { var _a; return !!((_a = input.usage) === null || _a === void 0 ? void 0 : _a.libraryPanels); });
        expect(processedDashboard.__inputs).toHaveLength(2);
        expect(dsInputsForLibPanels).toHaveLength(1);
    }));
    it('Should return 3 inputs, 2 for library panels', () => __awaiter(void 0, void 0, void 0, function* () {
        mocks.getLibraryPanel.mockImplementation(() => {
            throw { status: 404 };
        });
        const importDashboardState = initialImportDashboardState;
        const dashboardJson = Object.assign(Object.assign({}, importedJson), { __inputs: [
                {
                    name: 'DS_GDEV-MYSQL',
                    label: 'gdev-mysql',
                    description: '',
                    type: 'datasource',
                    value: '',
                },
                {
                    name: 'DS_GDEV-PROMETHEUS-FOR-LIBRARY-PANEL',
                    label: 'gdev-prometheus',
                    description: '',
                    type: 'datasource',
                    value: '',
                    usage: {
                        libraryPanels: [
                            {
                                name: 'another prom lib panel',
                                uid: 'a0379b21-fa20-4313-bf12-d7fd7ceb6f90',
                            },
                        ],
                    },
                },
                {
                    name: 'DS_GDEV-MYSQL-FOR-LIBRARY-PANEL',
                    label: 'gdev-mysql-2',
                    description: '',
                    type: 'datasource',
                    value: '',
                    usage: {
                        libraryPanels: [
                            {
                                uid: 'c46a6b49-de40-43b3-982c-1b5e1ec084a4',
                                name: 'Testing lib panel',
                            },
                        ],
                    },
                },
            ], __elements: Object.assign(Object.assign({}, libPanel), secondLibPanel), panels: [panel, panelWithLibPanel, panelWithSecondLibPanel] });
        const libPanelInputs = yield getLibraryPanelInputs(dashboardJson);
        const newDashboardState = Object.assign(Object.assign({}, importDashboardState), { inputs: Object.assign(Object.assign({}, importDashboardState.inputs), { libraryPanels: libPanelInputs }) });
        const processedDashboard = processDashboard(dashboardJson, newDashboardState);
        const dsInputsForLibPanels = processedDashboard.__inputs.filter((input) => { var _a; return !!((_a = input.usage) === null || _a === void 0 ? void 0 : _a.libraryPanels); });
        expect(processedDashboard.__inputs).toHaveLength(3);
        expect(dsInputsForLibPanels).toHaveLength(2);
    }));
    it('Should return 1 input, since library panels already exist in the instance', () => __awaiter(void 0, void 0, void 0, function* () {
        const getLibPanelFirstRS = {
            folderUid: '',
            uid: 'a0379b21-fa20-4313-bf12-d7fd7ceb6f90',
            name: 'another prom lib panel',
            type: 'timeseries',
            description: '',
            model: {
                transparent: false,
                transformations: [],
                datasource: {
                    type: 'prometheus',
                    uid: 'gdev-prometheus',
                },
                description: '',
                fieldConfig: {
                    defaults: {
                        color: {
                            mode: FieldColorModeId.PaletteClassic,
                        },
                        custom: {
                            axisCenteredZero: false,
                            axisColorMode: 'text',
                            axisLabel: '',
                            axisPlacement: 'auto',
                            barAlignment: 0,
                            drawStyle: 'line',
                            fillOpacity: 0,
                            gradientMode: 'none',
                            hideFrom: {
                                legend: false,
                                tooltip: false,
                                viz: false,
                            },
                            lineInterpolation: 'linear',
                            lineWidth: 1,
                            pointSize: 5,
                            scaleDistribution: {
                                type: 'linear',
                            },
                            showPoints: 'auto',
                            spanNulls: false,
                            stacking: {
                                group: 'A',
                                mode: 'none',
                            },
                            thresholdsStyle: {
                                mode: 'off',
                            },
                        },
                        mappings: [],
                        thresholds: {
                            mode: ThresholdsMode.Absolute,
                            steps: [
                                {
                                    color: 'green',
                                    value: null,
                                },
                                {
                                    color: 'red',
                                    value: 80,
                                },
                            ],
                        },
                    },
                    overrides: [],
                },
                options: {
                    legend: {
                        calcs: [],
                        displayMode: 'list',
                        placement: 'bottom',
                        showLegend: true,
                    },
                    tooltip: {
                        mode: 'single',
                        sort: 'none',
                    },
                },
                targets: [
                    {
                        datasource: {
                            type: 'prometheus',
                            uid: 'gdev-prometheus',
                        },
                        editorMode: 'builder',
                        expr: 'access_evaluation_duration_bucket',
                        instant: false,
                        range: true,
                        refId: 'A',
                    },
                ],
                title: 'Panel Title',
                type: 'timeseries',
            },
            version: 1,
        };
        const getLibPanelSecondRS = {
            folderUid: '',
            uid: 'c46a6b49-de40-43b3-982c-1b5e1ec084a4',
            name: 'Testing lib panel',
            type: 'timeseries',
            description: '',
            model: {
                transparent: false,
                transformations: [],
                datasource: {
                    type: 'prometheus',
                    uid: 'gdev-prometheus',
                },
                description: '',
                fieldConfig: {
                    defaults: {
                        color: {
                            mode: FieldColorModeId.PaletteClassic,
                        },
                        custom: {
                            axisCenteredZero: false,
                            axisColorMode: 'text',
                            axisLabel: '',
                            axisPlacement: 'auto',
                            barAlignment: 0,
                            drawStyle: 'line',
                            fillOpacity: 0,
                            gradientMode: 'none',
                            hideFrom: {
                                legend: false,
                                tooltip: false,
                                viz: false,
                            },
                            lineInterpolation: 'linear',
                            lineWidth: 1,
                            pointSize: 5,
                            scaleDistribution: {
                                type: 'linear',
                            },
                            showPoints: 'auto',
                            spanNulls: false,
                            stacking: {
                                group: 'A',
                                mode: 'none',
                            },
                            thresholdsStyle: {
                                mode: 'off',
                            },
                        },
                        mappings: [],
                        thresholds: {
                            mode: ThresholdsMode.Absolute,
                            steps: [
                                {
                                    color: 'green',
                                    value: null,
                                },
                                {
                                    color: 'red',
                                    value: 80,
                                },
                            ],
                        },
                    },
                    overrides: [],
                },
                options: {
                    legend: {
                        calcs: [],
                        displayMode: 'list',
                        placement: 'bottom',
                        showLegend: true,
                    },
                    tooltip: {
                        mode: 'single',
                        sort: 'none',
                    },
                },
                targets: [
                    {
                        datasource: {
                            type: 'prometheus',
                            uid: 'gdev-prometheus',
                        },
                        editorMode: 'builder',
                        expr: 'access_evaluation_duration_count',
                        instant: false,
                        range: true,
                        refId: 'A',
                    },
                ],
                title: 'Panel Title',
                type: 'timeseries',
            },
            version: 1,
        };
        mocks.getLibraryPanel
            .mockReturnValueOnce(Promise.resolve(getLibPanelFirstRS))
            .mockReturnValueOnce(Promise.resolve(getLibPanelSecondRS));
        const importDashboardState = initialImportDashboardState;
        const dashboardJson = Object.assign(Object.assign({}, importedJson), { __inputs: [
                {
                    name: 'DS_GDEV-MYSQL',
                    label: 'gdev-mysql',
                    description: '',
                    type: 'datasource',
                    value: '',
                },
                {
                    name: 'DS_GDEV-PROMETHEUS-FOR-LIBRARY-PANEL',
                    label: 'gdev-prometheus',
                    description: '',
                    type: 'datasource',
                    value: '',
                    usage: {
                        libraryPanels: [
                            {
                                name: 'another prom lib panel',
                                uid: 'a0379b21-fa20-4313-bf12-d7fd7ceb6f90',
                            },
                        ],
                    },
                },
                {
                    name: 'DS_GDEV-MYSQL-FOR-LIBRARY-PANEL',
                    label: 'gdev-mysql-2',
                    description: '',
                    type: 'datasource',
                    value: '',
                    usage: {
                        libraryPanels: [
                            {
                                uid: 'c46a6b49-de40-43b3-982c-1b5e1ec084a4',
                                name: 'Testing lib panel',
                            },
                        ],
                    },
                },
            ], __elements: Object.assign(Object.assign({}, libPanel), secondLibPanel), panels: [panel, panelWithLibPanel, panelWithSecondLibPanel] });
        const libPanelInputs = yield getLibraryPanelInputs(dashboardJson);
        const newDashboardState = Object.assign(Object.assign({}, importDashboardState), { inputs: Object.assign(Object.assign({}, importDashboardState.inputs), { libraryPanels: libPanelInputs }) });
        const processedDashboard = processDashboard(dashboardJson, newDashboardState);
        const dsInputsForLibPanels = processedDashboard.__inputs.filter((input) => { var _a; return !!((_a = input.usage) === null || _a === void 0 ? void 0 : _a.libraryPanels); });
        expect(processedDashboard.__inputs).toHaveLength(1);
        expect(dsInputsForLibPanels).toHaveLength(0);
    }));
});
//# sourceMappingURL=actions.test.js.map