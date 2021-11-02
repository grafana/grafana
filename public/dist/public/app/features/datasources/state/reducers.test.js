import { __assign } from "tslib";
import { reducerTester } from 'test/core/redux/reducerTester';
import { dataSourceLoaded, dataSourceMetaLoaded, dataSourcePluginsLoad, dataSourcePluginsLoaded, dataSourceSettingsReducer, dataSourcesLoaded, dataSourcesReducer, initDataSourceSettingsFailed, initDataSourceSettingsSucceeded, initialDataSourceSettingsState, initialState, setDataSourceName, setDataSourcesLayoutMode, setDataSourcesSearchQuery, setDataSourceTypeSearchQuery, setIsDefault, } from './reducers';
import { getMockDataSource, getMockDataSources } from '../__mocks__/dataSourcesMocks';
import { PluginType, LayoutModes } from '@grafana/data';
var mockPlugin = function () {
    return ({
        defaultNavUrl: 'defaultNavUrl',
        enabled: true,
        hasUpdate: true,
        id: 'id',
        info: {},
        latestVersion: 'latestVersion',
        name: 'name',
        pinned: true,
        type: PluginType.datasource,
        module: 'path/to/module',
    });
};
describe('dataSourcesReducer', function () {
    describe('when dataSourcesLoaded is dispatched', function () {
        it('then state should be correct', function () {
            var dataSources = getMockDataSources(1);
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(dataSourcesLoaded(dataSources))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { hasFetched: true, dataSources: dataSources, dataSourcesCount: 1 }));
        });
    });
    describe('when dataSourceLoaded is dispatched', function () {
        it('then state should be correct', function () {
            var dataSource = getMockDataSource();
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(dataSourceLoaded(dataSource))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { dataSource: dataSource }));
        });
    });
    describe('when setDataSourcesSearchQuery is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(setDataSourcesSearchQuery('some query'))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { searchQuery: 'some query' }));
        });
    });
    describe('when setDataSourcesLayoutMode is dispatched', function () {
        it('then state should be correct', function () {
            var layoutMode = LayoutModes.Grid;
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(setDataSourcesLayoutMode(layoutMode))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { layoutMode: LayoutModes.Grid }));
        });
    });
    describe('when dataSourcePluginsLoad is dispatched', function () {
        it('then state should be correct', function () {
            var state = __assign(__assign({}, initialState), { plugins: [mockPlugin()] });
            reducerTester()
                .givenReducer(dataSourcesReducer, state)
                .whenActionIsDispatched(dataSourcePluginsLoad())
                .thenStateShouldEqual(__assign(__assign({}, initialState), { isLoadingDataSources: true }));
        });
    });
    describe('when dataSourcePluginsLoaded is dispatched', function () {
        it('then state should be correct', function () {
            var dataSourceTypes = [mockPlugin()];
            var state = __assign(__assign({}, initialState), { isLoadingDataSources: true });
            reducerTester()
                .givenReducer(dataSourcesReducer, state)
                .whenActionIsDispatched(dataSourcePluginsLoaded({ plugins: dataSourceTypes, categories: [] }))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { plugins: dataSourceTypes, isLoadingDataSources: false }));
        });
    });
    describe('when setDataSourceTypeSearchQuery is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(setDataSourceTypeSearchQuery('type search query'))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { dataSourceTypeSearchQuery: 'type search query' }));
        });
    });
    describe('when dataSourceMetaLoaded is dispatched', function () {
        it('then state should be correct', function () {
            var dataSourceMeta = mockPlugin();
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(dataSourceMetaLoaded(dataSourceMeta))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { dataSourceMeta: dataSourceMeta }));
        });
    });
    describe('when setDataSourceName is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(setDataSourceName('some name'))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { dataSource: { name: 'some name' } }));
        });
    });
    describe('when setIsDefault is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(setIsDefault(true))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { dataSource: { isDefault: true } }));
        });
    });
});
describe('dataSourceSettingsReducer', function () {
    describe('when initDataSourceSettingsSucceeded is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(dataSourceSettingsReducer, __assign({}, initialDataSourceSettingsState))
                .whenActionIsDispatched(initDataSourceSettingsSucceeded({}))
                .thenStateShouldEqual(__assign(__assign({}, initialDataSourceSettingsState), { plugin: {}, loading: false }));
        });
    });
    describe('when initDataSourceSettingsFailed is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(dataSourceSettingsReducer, __assign(__assign({}, initialDataSourceSettingsState), { plugin: {} }))
                .whenActionIsDispatched(initDataSourceSettingsFailed(new Error('Some error')))
                .thenStatePredicateShouldEqual(function (resultingState) {
                expect(resultingState).toEqual({
                    testingStatus: {},
                    loadError: 'Some error',
                    loading: false,
                    plugin: null,
                });
                return true;
            });
        });
    });
});
//# sourceMappingURL=reducers.test.js.map