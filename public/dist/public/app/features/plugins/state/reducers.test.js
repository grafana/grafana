import { __assign } from "tslib";
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialState, pluginDashboardsLoad, pluginDashboardsLoaded, pluginsLoaded, pluginsReducer, setPluginsSearchQuery, } from './reducers';
import { PluginType } from '@grafana/data';
// Mock the config to enable the old version of the plugins page
jest.mock('@grafana/runtime', function () {
    var original = jest.requireActual('@grafana/runtime');
    var mockedRuntime = __assign({}, original);
    mockedRuntime.config.pluginAdminEnabled = false;
    return mockedRuntime;
});
describe('pluginsReducer', function () {
    describe('when pluginsLoaded is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(pluginsReducer, __assign({}, initialState))
                .whenActionIsDispatched(pluginsLoaded([
                {
                    id: 'some-id',
                    baseUrl: 'some-url',
                    module: 'some module',
                    name: 'Some Plugin',
                    type: PluginType.app,
                    info: {},
                },
            ]))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { hasFetched: true, plugins: [
                    {
                        baseUrl: 'some-url',
                        id: 'some-id',
                        info: {},
                        module: 'some module',
                        name: 'Some Plugin',
                        type: PluginType.app,
                    },
                ], errors: [] }));
        });
    });
    describe('when setPluginsSearchQuery is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(pluginsReducer, __assign({}, initialState))
                .whenActionIsDispatched(setPluginsSearchQuery('A query'))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { searchQuery: 'A query' }));
        });
    });
    describe('when pluginDashboardsLoad is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(pluginsReducer, __assign(__assign({}, initialState), { dashboards: [
                    {
                        dashboardId: 1,
                        title: 'Some Dash',
                        description: 'Some Desc',
                        folderId: 2,
                        imported: false,
                        importedRevision: 1,
                        importedUri: 'some-uri',
                        importedUrl: 'some-url',
                        path: 'some/path',
                        pluginId: 'some-plugin-id',
                        removed: false,
                        revision: 22,
                        slug: 'someSlug',
                    },
                ] }))
                .whenActionIsDispatched(pluginDashboardsLoad())
                .thenStateShouldEqual(__assign(__assign({}, initialState), { dashboards: [], isLoadingPluginDashboards: true }));
        });
    });
    describe('when pluginDashboardsLoad is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(pluginsReducer, __assign(__assign({}, initialState), { isLoadingPluginDashboards: true }))
                .whenActionIsDispatched(pluginDashboardsLoaded([
                {
                    dashboardId: 1,
                    title: 'Some Dash',
                    description: 'Some Desc',
                    folderId: 2,
                    imported: false,
                    importedRevision: 1,
                    importedUri: 'some-uri',
                    importedUrl: 'some-url',
                    path: 'some/path',
                    pluginId: 'some-plugin-id',
                    removed: false,
                    revision: 22,
                    slug: 'someSlug',
                },
            ]))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { dashboards: [
                    {
                        dashboardId: 1,
                        title: 'Some Dash',
                        description: 'Some Desc',
                        folderId: 2,
                        imported: false,
                        importedRevision: 1,
                        importedUri: 'some-uri',
                        importedUrl: 'some-url',
                        path: 'some/path',
                        pluginId: 'some-plugin-id',
                        removed: false,
                        revision: 22,
                        slug: 'someSlug',
                    },
                ], isLoadingPluginDashboards: false }));
        });
    });
});
//# sourceMappingURL=reducers.test.js.map