import { LoadingState } from '@grafana/data';
import { reducerTester } from '../../../../../test/core/redux/reducerTester';
import { changePage, initialLibraryPanelsViewState, initSearch, libraryPanelsViewReducer, searchCompleted, } from './reducer';
describe('libraryPanelsViewReducer', () => {
    describe('when initSearch is dispatched', () => {
        it('then the state should be correct', () => {
            reducerTester()
                .givenReducer(libraryPanelsViewReducer, Object.assign({}, initialLibraryPanelsViewState))
                .whenActionIsDispatched(initSearch())
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialLibraryPanelsViewState), { loadingState: LoadingState.Loading }));
        });
    });
    describe('when searchCompleted is dispatched', () => {
        it('then the state should be correct', () => {
            const payload = {
                perPage: 10,
                page: 3,
                libraryPanels: getLibraryPanelMocks(2),
                totalCount: 200,
            };
            reducerTester()
                .givenReducer(libraryPanelsViewReducer, Object.assign({}, initialLibraryPanelsViewState))
                .whenActionIsDispatched(searchCompleted(payload))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialLibraryPanelsViewState), { perPage: 10, page: 3, libraryPanels: payload.libraryPanels, totalCount: 200, loadingState: LoadingState.Done, numberOfPages: 20 }));
        });
        describe('and page is greater than the current number of pages', () => {
            it('then the state should be correct', () => {
                const payload = {
                    perPage: 10,
                    page: 21,
                    libraryPanels: getLibraryPanelMocks(2),
                    totalCount: 200,
                };
                reducerTester()
                    .givenReducer(libraryPanelsViewReducer, Object.assign({}, initialLibraryPanelsViewState))
                    .whenActionIsDispatched(searchCompleted(payload))
                    .thenStateShouldEqual(Object.assign(Object.assign({}, initialLibraryPanelsViewState), { perPage: 10, page: 20, libraryPanels: payload.libraryPanels, totalCount: 200, loadingState: LoadingState.Done, numberOfPages: 20 }));
            });
        });
    });
    describe('when changePage is dispatched', () => {
        it('then the state should be correct', () => {
            reducerTester()
                .givenReducer(libraryPanelsViewReducer, Object.assign({}, initialLibraryPanelsViewState))
                .whenActionIsDispatched(changePage({ page: 42 }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialLibraryPanelsViewState), { page: 42 }));
        });
    });
});
function getLibraryPanelMocks(count) {
    const mocks = [];
    for (let i = 0; i < count; i++) {
        mocks.push(mockLibraryPanel({
            uid: i.toString(10),
            name: `Test Panel ${i}`,
        }));
    }
    return mocks;
}
function mockLibraryPanel({ uid = '1', folderUid = '', name = 'Test Panel', model = { type: 'text', title: 'Test Panel' }, meta = {
    folderName: 'General',
    folderUid: '',
    connectedDashboards: 0,
    created: '2021-01-01T00:00:00',
    createdBy: { id: 1, name: 'User X', avatarUrl: '/avatar/abc' },
    updated: '2021-01-02T00:00:00',
    updatedBy: { id: 2, name: 'User Y', avatarUrl: '/avatar/xyz' },
}, version = 1, description = 'a description', type = 'text', } = {}) {
    return {
        uid,
        folderUid,
        name,
        model,
        version,
        meta,
        description,
        type,
    };
}
//# sourceMappingURL=reducer.test.js.map