import { reducerTester } from '../../../../../test/core/redux/reducerTester';
import { deleteLibraryPanelModalReducer, initialDeleteLibraryPanelModalState, searchCompleted, } from './reducer';
import { LoadingState } from '@grafana/data';
describe('deleteLibraryPanelModalReducer', function () {
    describe('when created', function () {
        it('then initial state should be correct', function () {
            reducerTester()
                .givenReducer(deleteLibraryPanelModalReducer, initialDeleteLibraryPanelModalState)
                .whenActionIsDispatched({ type: 'noop' })
                .thenStateShouldEqual({
                loadingState: LoadingState.Loading,
                dashboardTitles: [],
            });
        });
    });
    describe('when searchCompleted is dispatched', function () {
        it('then state should be correct', function () {
            var dashboards = [{ title: 'A' }, { title: 'B' }];
            reducerTester()
                .givenReducer(deleteLibraryPanelModalReducer, initialDeleteLibraryPanelModalState)
                .whenActionIsDispatched(searchCompleted({ dashboards: dashboards }))
                .thenStateShouldEqual({
                loadingState: LoadingState.Done,
                dashboardTitles: ['A', 'B'],
            });
        });
    });
});
//# sourceMappingURL=reducer.test.js.map