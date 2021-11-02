import { __assign } from "tslib";
import { find } from 'lodash';
import config from 'app/core/config';
import { DashboardExporter } from './DashboardExporter';
import { DashboardModel } from '../../state/DashboardModel';
import { variableAdapters } from '../../../variables/adapters';
import { createConstantVariableAdapter } from '../../../variables/constant/adapter';
import { createQueryVariableAdapter } from '../../../variables/query/adapter';
import { createDataSourceVariableAdapter } from '../../../variables/datasource/adapter';
import { LibraryElementKind } from '../../../library-panels/types';
jest.mock('app/core/store', function () {
    return {
        getBool: jest.fn(),
        getObject: jest.fn(),
    };
});
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getDataSourceSrv: function () {
        return {
            get: function (v) {
                var s = getStubInstanceSettings(v);
                // console.log('GET', v, s);
                return Promise.resolve(s);
            },
            getInstanceSettings: getStubInstanceSettings,
        };
    }, config: {
        buildInfo: {},
        panels: {},
        featureToggles: {
            newVariables: false,
        },
    } })); });
variableAdapters.register(createQueryVariableAdapter());
variableAdapters.register(createConstantVariableAdapter());
variableAdapters.register(createDataSourceVariableAdapter());
describe('given dashboard with repeated panels', function () {
    var dash, exported;
    beforeEach(function (done) {
        dash = {
            templating: {
                list: [
                    {
                        name: 'apps',
                        type: 'query',
                        datasource: { uid: 'gfdb', type: 'testdb' },
                        current: { value: 'Asd', text: 'Asd' },
                        options: [{ value: 'Asd', text: 'Asd' }],
                    },
                    {
                        name: 'prefix',
                        type: 'constant',
                        current: { value: 'collectd', text: 'collectd' },
                        options: [],
                        query: 'collectd',
                    },
                    {
                        name: 'ds',
                        type: 'datasource',
                        query: 'other2',
                        current: { value: 'other2', text: 'other2' },
                        options: [],
                    },
                ],
            },
            annotations: {
                list: [
                    {
                        name: 'logs',
                        datasource: { uid: 'gfdb', type: 'testdb' },
                    },
                ],
            },
            panels: [
                { id: 6, datasource: { uid: 'gfdb', type: 'testdb' }, type: 'graph' },
                { id: 7 },
                {
                    id: 8,
                    datasource: { uid: '-- Mixed --', type: 'mixed' },
                    targets: [{ datasource: { uid: 'other', type: 'other' } }],
                },
                { id: 9, datasource: { uid: '$ds', type: 'other2' } },
                {
                    id: 17,
                    datasource: { uid: '$ds', type: 'other2' },
                    type: 'graph',
                    libraryPanel: {
                        name: 'Library Panel 2',
                        uid: 'ah8NqyDPs',
                    },
                },
                {
                    id: 2,
                    repeat: 'apps',
                    datasource: { uid: 'gfdb', type: 'testdb' },
                    type: 'graph',
                },
                { id: 3, repeat: null, repeatPanelId: 2 },
                {
                    id: 4,
                    collapsed: true,
                    panels: [
                        { id: 10, datasource: { uid: 'gfdb', type: 'testdb' }, type: 'table' },
                        { id: 11 },
                        {
                            id: 12,
                            datasource: { uid: '-- Mixed --', type: 'mixed' },
                            targets: [{ datasource: { uid: 'other', type: 'other' } }],
                        },
                        { id: 13, datasource: { uid: '$uid', type: 'other' } },
                        {
                            id: 14,
                            repeat: 'apps',
                            datasource: { uid: 'gfdb', type: 'testdb' },
                            type: 'heatmap',
                        },
                        { id: 15, repeat: null, repeatPanelId: 14 },
                        {
                            id: 16,
                            datasource: { uid: 'gfdb', type: 'testdb' },
                            type: 'graph',
                            libraryPanel: {
                                name: 'Library Panel',
                                uid: 'jL6MrxCMz',
                            },
                        },
                    ],
                },
            ],
        };
        config.buildInfo.version = '3.0.2';
        config.panels['graph'] = {
            id: 'graph',
            name: 'Graph',
            info: { version: '1.1.0' },
        };
        config.panels['table'] = {
            id: 'table',
            name: 'Table',
            info: { version: '1.1.1' },
        };
        config.panels['heatmap'] = {
            id: 'heatmap',
            name: 'Heatmap',
            info: { version: '1.1.2' },
        };
        dash = new DashboardModel(dash, {}, function () { return dash.templating.list; });
        var exporter = new DashboardExporter();
        exporter.makeExportable(dash).then(function (clean) {
            exported = clean;
            done();
        });
    });
    it('should replace datasource refs', function () {
        var panel = exported.panels[0];
        expect(panel.datasource).toBe('${DS_GFDB}');
    });
    it('should replace datasource refs in collapsed row', function () {
        var panel = exported.panels[6].panels[0];
        expect(panel.datasource).toBe('${DS_GFDB}');
    });
    it('should replace datasource in variable query', function () {
        expect(exported.templating.list[0].datasource).toBe('${DS_GFDB}');
        expect(exported.templating.list[0].options.length).toBe(0);
        expect(exported.templating.list[0].current.value).toBe(undefined);
        expect(exported.templating.list[0].current.text).toBe(undefined);
    });
    it('should replace datasource in annotation query', function () {
        expect(exported.annotations.list[1].datasource).toBe('${DS_GFDB}');
    });
    it('should add datasource as input', function () {
        expect(exported.__inputs[0].name).toBe('DS_GFDB');
        expect(exported.__inputs[0].pluginId).toBe('testdb');
        expect(exported.__inputs[0].type).toBe('datasource');
    });
    it('should add datasource to required', function () {
        var require = find(exported.__requires, { name: 'TestDB' });
        expect(require.name).toBe('TestDB');
        expect(require.id).toBe('testdb');
        expect(require.type).toBe('datasource');
        expect(require.version).toBe('1.2.1');
    });
    it('should not add built in datasources to required', function () {
        var require = find(exported.__requires, { name: 'Mixed' });
        expect(require).toBe(undefined);
    });
    it('should add datasources used in mixed mode', function () {
        var require = find(exported.__requires, { name: 'OtherDB' });
        expect(require).not.toBe(undefined);
    });
    it('should add graph panel to required', function () {
        var require = find(exported.__requires, { name: 'Graph' });
        expect(require.name).toBe('Graph');
        expect(require.id).toBe('graph');
        expect(require.version).toBe('1.1.0');
    });
    it('should add table panel to required', function () {
        var require = find(exported.__requires, { name: 'Table' });
        expect(require.name).toBe('Table');
        expect(require.id).toBe('table');
        expect(require.version).toBe('1.1.1');
    });
    it('should add heatmap panel to required', function () {
        var require = find(exported.__requires, { name: 'Heatmap' });
        expect(require.name).toBe('Heatmap');
        expect(require.id).toBe('heatmap');
        expect(require.version).toBe('1.1.2');
    });
    it('should add grafana version', function () {
        var require = find(exported.__requires, { name: 'Grafana' });
        expect(require.type).toBe('grafana');
        expect(require.id).toBe('grafana');
        expect(require.version).toBe('3.0.2');
    });
    it('should add constant template variables as inputs', function () {
        var input = find(exported.__inputs, { name: 'VAR_PREFIX' });
        expect(input.type).toBe('constant');
        expect(input.label).toBe('prefix');
        expect(input.value).toBe('collectd');
    });
    it('should templatize constant variables', function () {
        var variable = find(exported.templating.list, { name: 'prefix' });
        expect(variable.query).toBe('${VAR_PREFIX}');
        expect(variable.current.text).toBe('${VAR_PREFIX}');
        expect(variable.current.value).toBe('${VAR_PREFIX}');
        expect(variable.options[0].text).toBe('${VAR_PREFIX}');
        expect(variable.options[0].value).toBe('${VAR_PREFIX}');
    });
    it('should add datasources only use via datasource variable to requires', function () {
        var require = find(exported.__requires, { name: 'OtherDB_2' });
        expect(require.id).toBe('other2');
    });
    it('should add library panels as elements', function () {
        var element = exported.__elements.find(function (element) { return element.uid === 'ah8NqyDPs'; });
        expect(element.name).toBe('Library Panel 2');
        expect(element.kind).toBe(LibraryElementKind.Panel);
        expect(element.model).toEqual({
            id: 17,
            datasource: '${DS_OTHER2}',
            type: 'graph',
            fieldConfig: {
                defaults: {},
                overrides: [],
            },
        });
    });
    it('should add library panels in collapsed rows as elements', function () {
        var element = exported.__elements.find(function (element) { return element.uid === 'jL6MrxCMz'; });
        expect(element.name).toBe('Library Panel');
        expect(element.kind).toBe(LibraryElementKind.Panel);
        expect(element.model).toEqual({
            id: 16,
            datasource: '${DS_GFDB}',
            type: 'graph',
        });
    });
});
function getStubInstanceSettings(v) {
    var _a, _b, _c, _d;
    var key = (_b = (_a = v) === null || _a === void 0 ? void 0 : _a.type) !== null && _b !== void 0 ? _b : v;
    return ((_d = stubs[(_c = key) !== null && _c !== void 0 ? _c : 'gfdb']) !== null && _d !== void 0 ? _d : stubs['gfdb']);
}
// Stub responses
var stubs = {};
stubs['gfdb'] = {
    name: 'gfdb',
    meta: { id: 'testdb', info: { version: '1.2.1' }, name: 'TestDB' },
};
stubs['other'] = {
    name: 'other',
    meta: { id: 'other', info: { version: '1.2.1' }, name: 'OtherDB' },
};
stubs['other2'] = {
    name: 'other2',
    meta: { id: 'other2', info: { version: '1.2.1' }, name: 'OtherDB_2' },
};
stubs['-- Mixed --'] = {
    name: 'mixed',
    meta: {
        id: 'mixed',
        info: { version: '1.2.1' },
        name: 'Mixed',
        builtIn: true,
    },
};
stubs['-- Grafana --'] = {
    name: '-- Grafana --',
    meta: {
        id: 'grafana',
        info: { version: '1.2.1' },
        name: 'grafana',
        builtIn: true,
    },
};
//# sourceMappingURL=DashboardExporter.test.js.map