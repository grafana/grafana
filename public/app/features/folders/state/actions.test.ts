import { Observable, of, throwError } from 'rxjs';
import { thunkTester } from 'test/core/thunk/thunkTester';

import { FetchResponse } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createWarningNotification } from 'app/core/copy/appNotification';
import { backendSrv } from 'app/core/services/backend_srv';

import { checkFolderPermissions } from './actions';
import { setCanViewFolderPermissions } from './reducers';

describe('folder actions', () => {
  let fetchSpy: jest.SpyInstance<Observable<FetchResponse<unknown>>>;

  beforeAll(() => {
    fetchSpy = jest.spyOn(backendSrv, 'fetch');
  });
  afterAll(() => {
    fetchSpy.mockRestore();
  });

  function mockFetch(resp: Observable<any>) {
    fetchSpy.mockReturnValueOnce(resp);
  }

  const folderUid = 'abc123';

  describe('checkFolderPermissions', () => {
    it('should dispatch true when the api call is successful', async () => {
      mockFetch(of({}));

      const dispatchedActions = await thunkTester({})
        .givenThunk(checkFolderPermissions)
        .whenThunkIsDispatched(folderUid);

      expect(dispatchedActions).toEqual([setCanViewFolderPermissions(true)]);
    });

    it('should dispatch just "false" when the api call fails with 403', async () => {
      mockFetch(throwError(() => ({ status: 403, data: { message: 'Access denied' } })));

      const dispatchedActions = await thunkTester({})
        .givenThunk(checkFolderPermissions)
        .whenThunkIsDispatched(folderUid);

      expect(dispatchedActions).toEqual([setCanViewFolderPermissions(false)]);
    });

    it('should also dispatch a notification when the api call fails with an error other than 403', async () => {
      mockFetch(throwError(() => ({ status: 500, data: { message: 'Server error' } })));

      const dispatchedActions = await thunkTester({})
        .givenThunk(checkFolderPermissions)
        .whenThunkIsDispatched(folderUid);

      const notificationAction = notifyApp(
        createWarningNotification('Error checking folder permissions', 'Server error')
      );
      notificationAction.payload.id = expect.any(String);
      notificationAction.payload.timestamp = expect.any(Number);

      expect(dispatchedActions).toEqual([
        expect.objectContaining(notificationAction),
        setCanViewFolderPermissions(false),
      ]);
    });
  });
});
