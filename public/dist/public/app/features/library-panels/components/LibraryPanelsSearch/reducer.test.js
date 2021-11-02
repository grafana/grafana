import { __assign } from "tslib";
import { reducerTester } from '../../../../../test/core/redux/reducerTester';
import { folderFilterChanged, initialLibraryPanelsSearchState, libraryPanelsSearchReducer, panelFilterChanged, searchChanged, sortChanged, } from './reducer';
describe('libraryPanelsSearchReducer', function () {
    describe('when searchChanged is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(libraryPanelsSearchReducer, __assign({}, initialLibraryPanelsSearchState))
                .whenActionIsDispatched(searchChanged('searching for'))
                .thenStateShouldEqual(__assign(__assign({}, initialLibraryPanelsSearchState), { searchQuery: 'searching for' }));
        });
    });
    describe('when sortChanged is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(libraryPanelsSearchReducer, __assign({}, initialLibraryPanelsSearchState))
                .whenActionIsDispatched(sortChanged({ label: 'Ascending', value: 'asc' }))
                .thenStateShouldEqual(__assign(__assign({}, initialLibraryPanelsSearchState), { sortDirection: 'asc' }));
        });
    });
    describe('when panelFilterChanged is dispatched', function () {
        it('then state should be correct', function () {
            var plugins = [
                { id: 'graph', name: 'Graph' },
                { id: 'timeseries', name: 'Time Series' },
            ];
            reducerTester()
                .givenReducer(libraryPanelsSearchReducer, __assign({}, initialLibraryPanelsSearchState))
                .whenActionIsDispatched(panelFilterChanged(plugins))
                .thenStateShouldEqual(__assign(__assign({}, initialLibraryPanelsSearchState), { panelFilter: ['graph', 'timeseries'] }));
        });
    });
    describe('when folderFilterChanged is dispatched', function () {
        it('then state should be correct', function () {
            var folders = [
                { id: 0, name: 'General' },
                { id: 1, name: 'Folder' },
            ];
            reducerTester()
                .givenReducer(libraryPanelsSearchReducer, __assign({}, initialLibraryPanelsSearchState))
                .whenActionIsDispatched(folderFilterChanged(folders))
                .thenStateShouldEqual(__assign(__assign({}, initialLibraryPanelsSearchState), { folderFilter: ['0', '1'] }));
        });
    });
});
//# sourceMappingURL=reducer.test.js.map