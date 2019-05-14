import * as tslib_1 from "tslib";
import { reducerTester } from 'test/core/redux/reducerTester';
import { dataSourcesReducer, initialState } from './reducers';
import { dataSourcesLoaded, dataSourceLoaded, setDataSourcesSearchQuery, setDataSourcesLayoutMode, dataSourceTypesLoad, dataSourceTypesLoaded, setDataSourceTypeSearchQuery, dataSourceMetaLoaded, setDataSourceName, setIsDefault, } from './actions';
import { getMockDataSources, getMockDataSource } from '../__mocks__/dataSourcesMocks';
import { LayoutModes } from 'app/core/components/LayoutSelector/LayoutSelector';
var mockPlugin = function () { return ({
    defaultNavUrl: 'defaultNavUrl',
    enabled: true,
    hasUpdate: true,
    id: 'id',
    info: {},
    latestVersion: 'latestVersion',
    name: 'name',
    pinned: true,
    state: 'state',
    type: 'type',
    module: {},
}); };
describe('dataSourcesReducer', function () {
    describe('when dataSourcesLoaded is dispatched', function () {
        it('then state should be correct', function () {
            var dataSources = getMockDataSources(0);
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(dataSourcesLoaded(dataSources))
                .thenStateShouldEqual(tslib_1.__assign({}, initialState, { hasFetched: true, dataSources: dataSources, dataSourcesCount: 1 }));
        });
    });
    describe('when dataSourceLoaded is dispatched', function () {
        it('then state should be correct', function () {
            var dataSource = getMockDataSource();
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(dataSourceLoaded(dataSource))
                .thenStateShouldEqual(tslib_1.__assign({}, initialState, { dataSource: dataSource }));
        });
    });
    describe('when setDataSourcesSearchQuery is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(setDataSourcesSearchQuery('some query'))
                .thenStateShouldEqual(tslib_1.__assign({}, initialState, { searchQuery: 'some query' }));
        });
    });
    describe('when setDataSourcesLayoutMode is dispatched', function () {
        it('then state should be correct', function () {
            var layoutMode = LayoutModes.Grid;
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(setDataSourcesLayoutMode(layoutMode))
                .thenStateShouldEqual(tslib_1.__assign({}, initialState, { layoutMode: LayoutModes.Grid }));
        });
    });
    describe('when dataSourceTypesLoad is dispatched', function () {
        it('then state should be correct', function () {
            var state = tslib_1.__assign({}, initialState, { dataSourceTypes: [mockPlugin()] });
            reducerTester()
                .givenReducer(dataSourcesReducer, state)
                .whenActionIsDispatched(dataSourceTypesLoad())
                .thenStateShouldEqual(tslib_1.__assign({}, initialState, { dataSourceTypes: [], isLoadingDataSources: true }));
        });
    });
    describe('when dataSourceTypesLoaded is dispatched', function () {
        it('then state should be correct', function () {
            var dataSourceTypes = [mockPlugin()];
            var state = tslib_1.__assign({}, initialState, { isLoadingDataSources: true });
            reducerTester()
                .givenReducer(dataSourcesReducer, state)
                .whenActionIsDispatched(dataSourceTypesLoaded(dataSourceTypes))
                .thenStateShouldEqual(tslib_1.__assign({}, initialState, { dataSourceTypes: dataSourceTypes, isLoadingDataSources: false }));
        });
    });
    describe('when setDataSourceTypeSearchQuery is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(setDataSourceTypeSearchQuery('type search query'))
                .thenStateShouldEqual(tslib_1.__assign({}, initialState, { dataSourceTypeSearchQuery: 'type search query' }));
        });
    });
    describe('when dataSourceMetaLoaded is dispatched', function () {
        it('then state should be correct', function () {
            var dataSourceMeta = mockPlugin();
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(dataSourceMetaLoaded(dataSourceMeta))
                .thenStateShouldEqual(tslib_1.__assign({}, initialState, { dataSourceMeta: dataSourceMeta }));
        });
    });
    describe('when setDataSourceName is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(setDataSourceName('some name'))
                .thenStateShouldEqual(tslib_1.__assign({}, initialState, { dataSource: { name: 'some name' } }));
        });
    });
    describe('when setIsDefault is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(dataSourcesReducer, initialState)
                .whenActionIsDispatched(setIsDefault(true))
                .thenStateShouldEqual(tslib_1.__assign({}, initialState, { dataSource: { isDefault: true } }));
        });
    });
});
//# sourceMappingURL=reducers.test.js.map