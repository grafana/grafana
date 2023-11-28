import { reducerTester } from 'test/core/redux/reducerTester';
import { PluginType, LayoutModes } from '@grafana/data';
import { getMockDataSource, getMockDataSources } from '../__mocks__';
import { dataSourceLoaded, dataSourceMetaLoaded, dataSourcePluginsLoad, dataSourcePluginsLoaded, dataSourceSettingsReducer, dataSourcesLoaded, dataSourcesReducer, initDataSourceSettingsFailed, initDataSourceSettingsSucceeded, initialDataSourceSettingsState, initialState, setDataSourceName, setDataSourcesLayoutMode, setDataSourcesSearchQuery, setDataSourceTypeSearchQuery, setIsDefault, } from './reducers';
const mockPlugin = () => ({
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
describe('dataSourcesReducer', () => {
    describe('when dataSourcesLoaded is dispatched', () => {
        it('then state should be correct', () => {
            const dataSources = getMockDataSources(1);
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(dataSourcesLoaded(dataSources))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { isLoadingDataSources: false, dataSources, dataSourcesCount: 1 }));
        });
    });
    describe('when dataSourceLoaded is dispatched', () => {
        it('then state should be correct', () => {
            const dataSource = getMockDataSource();
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(dataSourceLoaded(dataSource))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { dataSource }));
        });
    });
    describe('when setDataSourcesSearchQuery is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(setDataSourcesSearchQuery('some query'))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { searchQuery: 'some query' }));
        });
    });
    describe('when setDataSourcesLayoutMode is dispatched', () => {
        it('then state should be correct', () => {
            const layoutMode = LayoutModes.Grid;
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(setDataSourcesLayoutMode(layoutMode))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { layoutMode: LayoutModes.Grid }));
        });
    });
    describe('when dataSourcePluginsLoad is dispatched', () => {
        it('then state should be correct', () => {
            const state = Object.assign(Object.assign({}, initialState), { plugins: [mockPlugin()] });
            reducerTester()
                .givenReducer(dataSourcesReducer, state)
                .whenActionIsDispatched(dataSourcePluginsLoad())
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { isLoadingDataSourcePlugins: true }));
        });
    });
    describe('when dataSourcePluginsLoaded is dispatched', () => {
        it('then state should be correct', () => {
            const dataSourceTypes = [mockPlugin()];
            const state = Object.assign(Object.assign({}, initialState), { isLoadingDataSourcePlugins: true });
            reducerTester()
                .givenReducer(dataSourcesReducer, state)
                .whenActionIsDispatched(dataSourcePluginsLoaded({ plugins: dataSourceTypes, categories: [] }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { plugins: dataSourceTypes, isLoadingDataSourcePlugins: false }));
        });
    });
    describe('when setDataSourceTypeSearchQuery is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(setDataSourceTypeSearchQuery('type search query'))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { dataSourceTypeSearchQuery: 'type search query' }));
        });
    });
    describe('when dataSourceMetaLoaded is dispatched', () => {
        it('then state should be correct', () => {
            const dataSourceMeta = mockPlugin();
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(dataSourceMetaLoaded(dataSourceMeta))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { dataSourceMeta }));
        });
    });
    describe('when setDataSourceName is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(setDataSourceName('some name'))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { dataSource: { name: 'some name' } }));
        });
    });
    describe('when setIsDefault is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(setIsDefault(true))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { dataSource: { isDefault: true } }));
        });
    });
});
describe('dataSourceSettingsReducer', () => {
    describe('when initDataSourceSettingsSucceeded is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(dataSourceSettingsReducer, Object.assign({}, initialDataSourceSettingsState))
                .whenActionIsDispatched(initDataSourceSettingsSucceeded({}))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialDataSourceSettingsState), { plugin: {}, loading: false }));
        });
    });
    describe('when initDataSourceSettingsFailed is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(dataSourceSettingsReducer, Object.assign(Object.assign({}, initialDataSourceSettingsState), { plugin: {} }))
                .whenActionIsDispatched(initDataSourceSettingsFailed(new Error('Some error')))
                .thenStatePredicateShouldEqual((resultingState) => {
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