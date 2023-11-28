import { LoadingState } from '@grafana/data';
import { reducerTester } from '../../../../../test/core/redux/reducerTester';
import { deleteLibraryPanelModalReducer, initialDeleteLibraryPanelModalState, searchCompleted, } from './reducer';
describe('deleteLibraryPanelModalReducer', () => {
    describe('when created', () => {
        it('then initial state should be correct', () => {
            reducerTester()
                .givenReducer(deleteLibraryPanelModalReducer, initialDeleteLibraryPanelModalState)
                .whenActionIsDispatched({ type: 'noop' })
                .thenStateShouldEqual({
                loadingState: LoadingState.Loading,
                dashboardTitles: [],
            });
        });
    });
    describe('when searchCompleted is dispatched', () => {
        it('then state should be correct', () => {
            const dashboards = [{ title: 'A' }, { title: 'B' }];
            reducerTester()
                .givenReducer(deleteLibraryPanelModalReducer, initialDeleteLibraryPanelModalState)
                .whenActionIsDispatched(searchCompleted({ dashboards }))
                .thenStateShouldEqual({
                loadingState: LoadingState.Done,
                dashboardTitles: ['A', 'B'],
            });
        });
    });
});
//# sourceMappingURL=reducer.test.js.map