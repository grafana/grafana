import { __assign } from "tslib";
import { LoadingState } from '@grafana/data';
import { reducerTester } from '../../../../../test/core/redux/reducerTester';
import { changePage, initialLibraryPanelsViewState, initSearch, libraryPanelsViewReducer, searchCompleted, } from './reducer';
import { LibraryElementKind } from '../../types';
describe('libraryPanelsViewReducer', function () {
    describe('when initSearch is dispatched', function () {
        it('then the state should be correct', function () {
            reducerTester()
                .givenReducer(libraryPanelsViewReducer, __assign({}, initialLibraryPanelsViewState))
                .whenActionIsDispatched(initSearch())
                .thenStateShouldEqual(__assign(__assign({}, initialLibraryPanelsViewState), { loadingState: LoadingState.Loading }));
        });
    });
    describe('when searchCompleted is dispatched', function () {
        it('then the state should be correct', function () {
            var payload = {
                perPage: 10,
                page: 3,
                libraryPanels: getLibraryPanelMocks(2),
                totalCount: 200,
            };
            reducerTester()
                .givenReducer(libraryPanelsViewReducer, __assign({}, initialLibraryPanelsViewState))
                .whenActionIsDispatched(searchCompleted(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialLibraryPanelsViewState), { perPage: 10, page: 3, libraryPanels: payload.libraryPanels, totalCount: 200, loadingState: LoadingState.Done, numberOfPages: 20 }));
        });
        describe('and page is greater than the current number of pages', function () {
            it('then the state should be correct', function () {
                var payload = {
                    perPage: 10,
                    page: 21,
                    libraryPanels: getLibraryPanelMocks(2),
                    totalCount: 200,
                };
                reducerTester()
                    .givenReducer(libraryPanelsViewReducer, __assign({}, initialLibraryPanelsViewState))
                    .whenActionIsDispatched(searchCompleted(payload))
                    .thenStateShouldEqual(__assign(__assign({}, initialLibraryPanelsViewState), { perPage: 10, page: 20, libraryPanels: payload.libraryPanels, totalCount: 200, loadingState: LoadingState.Done, numberOfPages: 20 }));
            });
        });
    });
    describe('when changePage is dispatched', function () {
        it('then the state should be correct', function () {
            reducerTester()
                .givenReducer(libraryPanelsViewReducer, __assign({}, initialLibraryPanelsViewState))
                .whenActionIsDispatched(changePage({ page: 42 }))
                .thenStateShouldEqual(__assign(__assign({}, initialLibraryPanelsViewState), { page: 42 }));
        });
    });
});
function getLibraryPanelMocks(count) {
    var mocks = [];
    for (var i = 0; i < count; i++) {
        mocks.push(mockLibraryPanel({
            uid: i.toString(10),
            id: i,
            name: "Test Panel " + i,
        }));
    }
    return mocks;
}
function mockLibraryPanel(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.uid, uid = _c === void 0 ? '1' : _c, _d = _b.id, id = _d === void 0 ? 1 : _d, _e = _b.orgId, orgId = _e === void 0 ? 1 : _e, _f = _b.folderId, folderId = _f === void 0 ? 0 : _f, _g = _b.name, name = _g === void 0 ? 'Test Panel' : _g, _h = _b.model, model = _h === void 0 ? { type: 'text', title: 'Test Panel' } : _h, _j = _b.meta, meta = _j === void 0 ? {
        folderName: 'General',
        folderUid: '',
        connectedDashboards: 0,
        created: '2021-01-01T00:00:00',
        createdBy: { id: 1, name: 'User X', avatarUrl: '/avatar/abc' },
        updated: '2021-01-02T00:00:00',
        updatedBy: { id: 2, name: 'User Y', avatarUrl: '/avatar/xyz' },
    } : _j, _k = _b.version, version = _k === void 0 ? 1 : _k, _l = _b.description, description = _l === void 0 ? 'a description' : _l, _m = _b.type, type = _m === void 0 ? 'text' : _m;
    return {
        uid: uid,
        id: id,
        orgId: orgId,
        folderId: folderId,
        name: name,
        kind: LibraryElementKind.Panel,
        model: model,
        version: version,
        meta: meta,
        description: description,
        type: type,
    };
}
//# sourceMappingURL=reducer.test.js.map