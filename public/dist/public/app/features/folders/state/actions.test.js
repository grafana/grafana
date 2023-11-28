import { __awaiter } from "tslib";
import { of, throwError } from 'rxjs';
import { thunkTester } from 'test/core/thunk/thunkTester';
import { notifyApp } from 'app/core/actions';
import { createWarningNotification } from 'app/core/copy/appNotification';
import { backendSrv } from 'app/core/services/backend_srv';
import { checkFolderPermissions } from './actions';
import { setCanViewFolderPermissions } from './reducers';
describe('folder actions', () => {
    let fetchSpy;
    beforeAll(() => {
        fetchSpy = jest.spyOn(backendSrv, 'fetch');
    });
    afterAll(() => {
        fetchSpy.mockRestore();
    });
    function mockFetch(resp) {
        fetchSpy.mockReturnValueOnce(resp);
    }
    const folderUid = 'abc123';
    describe('checkFolderPermissions', () => {
        it('should dispatch true when the api call is successful', () => __awaiter(void 0, void 0, void 0, function* () {
            mockFetch(of({}));
            const dispatchedActions = yield thunkTester({})
                .givenThunk(checkFolderPermissions)
                .whenThunkIsDispatched(folderUid);
            expect(dispatchedActions).toEqual([setCanViewFolderPermissions(true)]);
        }));
        it('should dispatch just "false" when the api call fails with 403', () => __awaiter(void 0, void 0, void 0, function* () {
            mockFetch(throwError(() => ({ status: 403, data: { message: 'Access denied' } })));
            const dispatchedActions = yield thunkTester({})
                .givenThunk(checkFolderPermissions)
                .whenThunkIsDispatched(folderUid);
            expect(dispatchedActions).toEqual([setCanViewFolderPermissions(false)]);
        }));
        it('should also dispatch a notification when the api call fails with an error other than 403', () => __awaiter(void 0, void 0, void 0, function* () {
            mockFetch(throwError(() => ({ status: 500, data: { message: 'Server error' } })));
            const dispatchedActions = yield thunkTester({})
                .givenThunk(checkFolderPermissions)
                .whenThunkIsDispatched(folderUid);
            const notificationAction = notifyApp(createWarningNotification('Error checking folder permissions', 'Server error'));
            notificationAction.payload.id = expect.any(String);
            notificationAction.payload.timestamp = expect.any(Number);
            expect(dispatchedActions).toEqual([
                expect.objectContaining(notificationAction),
                setCanViewFolderPermissions(false),
            ]);
        }));
    });
});
//# sourceMappingURL=actions.test.js.map