import { BackendSrv } from '../services/backend_srv';
import { Emitter } from '../utils/emitter';
import { ContextSrv, User } from '../services/context_srv';
import { of } from 'rxjs';
import { AppEvents } from '@grafana/data';

const getTestContext = (overides?: object) => {
  const defaults = {
    data: { test: 'hello world' },
    ok: true,
    status: 200,
    statusText: 'Ok',
    isSignedIn: true,
    orgId: 1337,
  };
  const props = { ...defaults, ...overides };
  const textMock = jest.fn().mockResolvedValue(JSON.stringify(props.data));
  const fromFetchMock = jest.fn().mockImplementation(() => {
    return of({
      ok: props.ok,
      status: props.status,
      statusText: props.statusText,
      text: textMock,
    });
  });
  const appEventsMock: Emitter = ({
    emit: jest.fn(),
  } as any) as Emitter;
  const user: User = ({
    isSignedIn: props.isSignedIn,
    orgId: props.orgId,
  } as any) as User;
  const contextSrvMock: ContextSrv = ({
    user,
  } as any) as ContextSrv;
  const logoutMock = jest.fn();
  const backendSrv = new BackendSrv({
    fromFetch: fromFetchMock,
    appEvents: appEventsMock,
    contextSrv: contextSrvMock,
    logout: logoutMock,
  });

  return { backendSrv, fromFetchMock, appEventsMock, contextSrvMock, textMock, logoutMock };
};

describe('backendSrv', () => {
  describe('request', () => {
    describe('when called with a non local url', () => {
      it('then it should not add headers or trim url', async () => {
        const { backendSrv, fromFetchMock, appEventsMock } = getTestContext();
        const url = 'http://www.some.url.com';
        const result = await backendSrv.request({ url });
        expect(result).toEqual({ test: 'hello world' });
        expect(fromFetchMock).toHaveBeenCalledTimes(1);
        expect(fromFetchMock).toHaveBeenCalledWith(url, {
          method: undefined,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*' },
          body: undefined,
        });
        expect(appEventsMock.emit).not.toHaveBeenCalled();
      });
    });

    describe('when called with a local url', () => {
      it('then it should add headers and trim url', async () => {
        const { backendSrv, fromFetchMock, appEventsMock } = getTestContext();
        const url = '/some/url/';
        const result = await backendSrv.request({ url });
        expect(result).toEqual({ test: 'hello world' });
        expect(fromFetchMock).toHaveBeenCalledTimes(1);
        expect(fromFetchMock).toHaveBeenCalledWith('some/url', {
          method: undefined,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
            'X-Grafana-Org-Id': 1337,
          },
          body: undefined,
        });
        expect(appEventsMock.emit).not.toHaveBeenCalled();
      });

      describe('and user has no orgId', () => {
        it('then it should not add headers but trim url', async () => {
          const { backendSrv, fromFetchMock, appEventsMock } = getTestContext({ orgId: undefined });
          const url = '/some/url/';
          const result = await backendSrv.request({ url });
          expect(result).toEqual({ test: 'hello world' });
          expect(fromFetchMock).toHaveBeenCalledTimes(1);
          expect(fromFetchMock).toHaveBeenCalledWith('some/url', {
            method: undefined,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json, text/plain, */*',
              'X-Grafana-Org-Id': undefined,
            },
            body: undefined,
          });
          expect(appEventsMock.emit).not.toHaveBeenCalled();
        });
      });
    });

    describe('when making a successful call and conditions for showSuccessAlert are not favorable', () => {
      it('then it should return correct result and not emit anything', async () => {
        const { backendSrv, fromFetchMock, appEventsMock } = getTestContext({ data: { message: 'A message' } });
        const url = '/api/dashboard/';
        const result = await backendSrv.request({ url, method: 'DELETE', showSuccessAlert: false });
        expect(result).toEqual({ message: 'A message' });
        expect(fromFetchMock).toHaveBeenCalledTimes(1);
        expect(fromFetchMock).toHaveBeenCalledWith('api/dashboard', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
            'X-Grafana-Org-Id': 1337,
          },
          body: undefined,
        });
        expect(appEventsMock.emit).not.toHaveBeenCalled();
      });
    });

    describe('when making a successful call and conditions for showSuccessAlert are favorable', () => {
      it('then it should emit correct message', async () => {
        const { backendSrv, fromFetchMock, appEventsMock } = getTestContext({ data: { message: 'A message' } });
        const url = '/api/dashboard/';
        const result = await backendSrv.request({ url, method: 'DELETE', showSuccessAlert: true });
        expect(result).toEqual({ message: 'A message' });
        expect(fromFetchMock).toHaveBeenCalledTimes(1);
        expect(fromFetchMock).toHaveBeenCalledWith('api/dashboard', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
            'X-Grafana-Org-Id': 1337,
          },
          body: undefined,
        });
        expect(appEventsMock.emit).toHaveBeenCalledTimes(1);
        expect(appEventsMock.emit).toHaveBeenCalledWith(AppEvents.alertSuccess, ['A message']);
      });
    });

    describe('when making an unsuccessful call and conditions for retry are favorable and loginPing does not throw', () => {
      it('then it should retry', async () => {
        jest.useFakeTimers();
        const { backendSrv, fromFetchMock, appEventsMock, logoutMock } = getTestContext({
          ok: false,
          status: 401,
          statusText: 'UnAuthorized',
          data: { message: 'UnAuthorized' },
        });
        backendSrv.loginPing = jest
          .fn()
          .mockResolvedValue({ ok: true, status: 200, statusText: 'OK', data: { message: 'Ok' } });
        const url = '/api/dashboard/';
        // it would be better if we could simulate that after the call to loginPing everything is successful but as
        // our fromFetchMock returns ok:false the second time this retries it will still be ok:false going into the
        // mergeMap in toFailureStream
        await backendSrv.request({ url, method: 'GET' }).catch(error => {
          expect(error.status).toBe(401);
          expect(error.statusText).toBe('UnAuthorized');
          expect(error.data).toEqual({ message: 'UnAuthorized' });
          expect(fromFetchMock).toHaveBeenCalledTimes(1);
          expect(fromFetchMock).toHaveBeenCalledWith('api/dashboard', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json, text/plain, */*',
              'X-Grafana-Org-Id': 1337,
            },
            body: undefined,
          });
          expect(appEventsMock.emit).not.toHaveBeenCalled();
          expect(backendSrv.loginPing).toHaveBeenCalledTimes(1);
          expect(logoutMock).toHaveBeenCalledTimes(1);
          jest.advanceTimersByTime(50);
          expect(appEventsMock.emit).not.toHaveBeenCalled();
        });
      });
    });

    describe('when making an unsuccessful call and conditions for retry are favorable and retry throws', () => {
      it('then it throw error', async () => {
        jest.useFakeTimers();
        const { backendSrv, fromFetchMock, appEventsMock, logoutMock } = getTestContext({
          ok: false,
          status: 401,
          statusText: 'UnAuthorized',
          data: { message: 'UnAuthorized' },
        });
        backendSrv.loginPing = jest
          .fn()
          .mockRejectedValue({ status: 403, statusText: 'Forbidden', data: { message: 'Forbidden' } });
        const url = '/api/dashboard/';
        await backendSrv
          .request({ url, method: 'GET' })
          .catch(error => {
            expect(error.status).toBe(403);
            expect(error.statusText).toBe('Forbidden');
            expect(error.data).toEqual({ message: 'Forbidden' });
            expect(fromFetchMock).toHaveBeenCalledTimes(1);
            expect(fromFetchMock).toHaveBeenCalledWith('api/dashboard', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json, text/plain, */*',
                'X-Grafana-Org-Id': 1337,
              },
              body: undefined,
            });
            expect(appEventsMock.emit).not.toHaveBeenCalled();
            expect(backendSrv.loginPing).toHaveBeenCalledTimes(1);
            expect(logoutMock).not.toHaveBeenCalled();
            jest.advanceTimersByTime(50);
          })
          .catch(error => {
            expect(error).toEqual({ message: 'Forbidden' });
            expect(appEventsMock.emit).toHaveBeenCalledTimes(1);
            expect(appEventsMock.emit).toHaveBeenCalledWith(AppEvents.alertWarning, ['Forbidden', '']);
          });
      });
    });

    describe('when making an unsuccessful 422 call', () => {
      it('then it should emit Validation failed message', async () => {
        jest.useFakeTimers();
        const { backendSrv, fromFetchMock, appEventsMock, logoutMock } = getTestContext({
          ok: false,
          status: 422,
          statusText: 'Unprocessable Entity',
          data: { message: 'Unprocessable Entity' },
        });
        const url = '/api/dashboard/';
        await backendSrv
          .request({ url, method: 'GET' })
          .catch(error => {
            expect(error.status).toBe(422);
            expect(error.statusText).toBe('Unprocessable Entity');
            expect(error.data).toEqual({ message: 'Unprocessable Entity' });
            expect(fromFetchMock).toHaveBeenCalledTimes(1);
            expect(fromFetchMock).toHaveBeenCalledWith('api/dashboard', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json, text/plain, */*',
                'X-Grafana-Org-Id': 1337,
              },
              body: undefined,
            });
            expect(appEventsMock.emit).not.toHaveBeenCalled();
            expect(logoutMock).not.toHaveBeenCalled();
            jest.advanceTimersByTime(50);
          })
          .catch(error => {
            expect(error).toEqual({ message: 'Unprocessable Entity' });
            expect(appEventsMock.emit).toHaveBeenCalledTimes(1);
            expect(appEventsMock.emit).toHaveBeenCalledWith(AppEvents.alertWarning, [
              'Validation failed',
              'Unprocessable Entity',
            ]);
          });
      });
    });

    describe('when making an unsuccessful call and we handle the error', () => {
      it('then it should not emit message', async () => {
        jest.useFakeTimers();
        const { backendSrv, fromFetchMock, appEventsMock, logoutMock } = getTestContext({
          ok: false,
          status: 401,
          statusText: 'UnAuthorized',
          data: { message: 'UnAuthorized' },
        });
        backendSrv.loginPing = jest
          .fn()
          .mockRejectedValue({ ok: false, status: 403, statusText: 'Forbidden', data: { message: 'Forbidden' } });
        const url = '/api/dashboard/';
        await backendSrv.request({ url, method: 'GET' }).catch(error => {
          expect(error.status).toBe(403);
          expect(error.statusText).toBe('Forbidden');
          expect(error.data).toEqual({ message: 'Forbidden' });
          expect(fromFetchMock).toHaveBeenCalledTimes(1);
          expect(fromFetchMock).toHaveBeenCalledWith('api/dashboard', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json, text/plain, */*',
              'X-Grafana-Org-Id': 1337,
            },
            body: undefined,
          });
          expect(appEventsMock.emit).not.toHaveBeenCalled();
          expect(backendSrv.loginPing).toHaveBeenCalledTimes(1);
          expect(logoutMock).not.toHaveBeenCalled();
          error.isHandled = true;
          jest.advanceTimersByTime(50);
          expect(appEventsMock.emit).not.toHaveBeenCalled();
        });
      });
    });
  });
});

// describe('backend_srv', () => {
//   const _backendSrv = new BackendSrv();
//
//   beforeEach(() => {
//     jest.clearAllMocks();
//   });
//
//   describe('when handling errors', () => {
//     it('should return the http status code', async () => {
//       try {
//         await _backendSrv.datasourceRequest({
//           url: 'gateway-error',
//         });
//       } catch (err) {
//         expect(err.status).toBe(502);
//       }
//     });
//   });
//
//   it('should cancel in-flight request if new one comes in with same id', async () => {
//     (fromFetch as jest.Mock)
//       .mockImplementationOnce(() =>
//         of({
//           ok: true,
//           text: () => Promise.resolve(JSON.stringify({ testdata: 'goodbye' })),
//         }).pipe(delay(10000))
//       )
//       .mockImplementation(() =>
//         of({
//           ok: true,
//           text: () => Promise.resolve(JSON.stringify({ testdata: 'hello' })),
//         })
//       );
//
//     const options = {
//       url: 'fakeurl',
//       requestId: 'my-id',
//     };
//
//     const firstReq = _backendSrv.datasourceRequest(options);
//
//     const res = await _backendSrv.datasourceRequest(options);
//     expect(res).toStrictEqual({
//       data: { testdata: 'hello' },
//     });
//
//     const firstRes = await firstReq;
//     expect(firstRes).toBe(undefined);
//   });
// });
