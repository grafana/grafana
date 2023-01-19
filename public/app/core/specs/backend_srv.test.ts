import 'whatwg-fetch'; // fetch polyfill needed for PhantomJs rendering
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import { AppEvents, DataQueryErrorType, EventBusExtended } from '@grafana/data';
import { BackendSrvRequest, FetchError } from '@grafana/runtime';

import { TokenRevokedModal } from '../../features/users/TokenRevokedModal';
import { ShowModalReactEvent } from '../../types/events';
import { BackendSrv } from '../services/backend_srv';
import { ContextSrv, User } from '../services/context_srv';

const getTestContext = (overides?: object) => {
  const defaults = {
    data: { test: 'hello world' },
    ok: true,
    status: 200,
    statusText: 'Ok',
    isSignedIn: true,
    orgId: 1337,
    redirected: false,
    type: 'basic',
    url: 'http://localhost:3000/api/some-mock',
  };
  const props = { ...defaults, ...overides };
  const textMock = jest.fn().mockResolvedValue(JSON.stringify(props.data));
  const fromFetchMock = jest.fn().mockImplementation(() => {
    const mockedResponse = {
      ok: props.ok,
      status: props.status,
      statusText: props.statusText,
      text: textMock,
      redirected: false,
      type: 'basic',
      url: 'http://localhost:3000/api/some-mock',
    };
    return of(mockedResponse);
  });

  const appEventsMock: EventBusExtended = {
    emit: jest.fn(),
    publish: jest.fn(),
  } as jest.MockedObject<EventBusExtended>;

  const user: User = {
    isSignedIn: props.isSignedIn,
    orgId: props.orgId,
  } as jest.MockedObject<User>;
  const contextSrvMock: ContextSrv = {
    user,
  } as jest.MockedObject<ContextSrv>;
  const logoutMock = jest.fn();
  const parseRequestOptionsMock = jest.fn().mockImplementation((options) => options);

  const backendSrv = new BackendSrv({
    fromFetch: fromFetchMock,
    appEvents: appEventsMock,
    contextSrv: contextSrvMock,
    logout: logoutMock,
  });

  backendSrv['parseRequestOptions'] = parseRequestOptionsMock;

  const expectCallChain = () => {
    expect(fromFetchMock).toHaveBeenCalledTimes(1);
  };

  const expectRequestCallChain = (options: any) => {
    expect(parseRequestOptionsMock).toHaveBeenCalledTimes(1);
    expect(parseRequestOptionsMock).toHaveBeenCalledWith(options);
    expectCallChain();
  };

  return {
    backendSrv,
    fromFetchMock,
    appEventsMock,
    contextSrvMock,
    textMock,
    logoutMock,
    parseRequestOptionsMock,
    expectRequestCallChain,
  };
};

describe('backendSrv', () => {
  describe('parseRequestOptions', () => {
    it.each`
      retry        | url                                      | headers                           | orgId        | noBackendCache | expected
      ${undefined} | ${'http://localhost:3000/api/dashboard'} | ${undefined}                      | ${undefined} | ${undefined}   | ${{ hideFromInspector: false, retry: 0, url: 'http://localhost:3000/api/dashboard' }}
      ${1}         | ${'http://localhost:3000/api/dashboard'} | ${{ Authorization: 'Some Auth' }} | ${1}         | ${true}        | ${{ hideFromInspector: false, retry: 1, url: 'http://localhost:3000/api/dashboard', headers: { Authorization: 'Some Auth' } }}
      ${undefined} | ${'api/dashboard'}                       | ${undefined}                      | ${undefined} | ${undefined}   | ${{ hideFromInspector: true, retry: 0, url: 'api/dashboard' }}
      ${undefined} | ${'/api/dashboard'}                      | ${undefined}                      | ${undefined} | ${undefined}   | ${{ hideFromInspector: true, retry: 0, url: 'api/dashboard' }}
      ${undefined} | ${'/api/dashboard/'}                     | ${undefined}                      | ${undefined} | ${undefined}   | ${{ hideFromInspector: true, retry: 0, url: 'api/dashboard/' }}
      ${undefined} | ${'/api/dashboard/'}                     | ${{ Authorization: 'Some Auth' }} | ${undefined} | ${undefined}   | ${{ hideFromInspector: true, retry: 0, url: 'api/dashboard/', headers: { 'X-DS-Authorization': 'Some Auth' } }}
      ${undefined} | ${'/api/dashboard/'}                     | ${{ Authorization: 'Some Auth' }} | ${1}         | ${undefined}   | ${{ hideFromInspector: true, retry: 0, url: 'api/dashboard/', headers: { 'X-DS-Authorization': 'Some Auth', 'X-Grafana-Org-Id': 1 } }}
      ${undefined} | ${'/api/dashboard/'}                     | ${{ Authorization: 'Some Auth' }} | ${1}         | ${true}        | ${{ hideFromInspector: true, retry: 0, url: 'api/dashboard/', headers: { 'X-DS-Authorization': 'Some Auth', 'X-Grafana-Org-Id': 1, 'X-Grafana-NoCache': 'true' } }}
      ${1}         | ${'/api/dashboard/'}                     | ${undefined}                      | ${undefined} | ${undefined}   | ${{ hideFromInspector: true, retry: 1, url: 'api/dashboard/' }}
      ${1}         | ${'/api/dashboard/'}                     | ${{ Authorization: 'Some Auth' }} | ${undefined} | ${undefined}   | ${{ hideFromInspector: true, retry: 1, url: 'api/dashboard/', headers: { 'X-DS-Authorization': 'Some Auth' } }}
      ${1}         | ${'/api/dashboard/'}                     | ${{ Authorization: 'Some Auth' }} | ${1}         | ${undefined}   | ${{ hideFromInspector: true, retry: 1, url: 'api/dashboard/', headers: { 'X-DS-Authorization': 'Some Auth', 'X-Grafana-Org-Id': 1 } }}
      ${1}         | ${'/api/dashboard/'}                     | ${{ Authorization: 'Some Auth' }} | ${1}         | ${true}        | ${{ hideFromInspector: true, retry: 1, url: 'api/dashboard/', headers: { 'X-DS-Authorization': 'Some Auth', 'X-Grafana-Org-Id': 1, 'X-Grafana-NoCache': 'true' } }}
      ${undefined} | ${'api/datasources/proxy'}               | ${undefined}                      | ${undefined} | ${undefined}   | ${{ hideFromInspector: false, retry: 0, url: 'api/datasources/proxy' }}
    `(
      "when called with retry: '$retry', url: '$url' and orgId: '$orgId' then result should be '$expected'",
      async ({ retry, url, headers, orgId, noBackendCache, expected }) => {
        const srv = new BackendSrv({
          contextSrv: {
            user: {
              orgId: orgId,
            },
          },
        } as any);

        if (noBackendCache) {
          await srv.withNoBackendCache(async () => {
            expect(srv['parseRequestOptions']({ retry, url, headers })).toEqual(expected);
          });
        } else {
          expect(srv['parseRequestOptions']({ retry, url, headers })).toEqual(expected);
        }
      }
    );
  });

  describe('request', () => {
    describe('when making a successful call and conditions for showSuccessAlert are not favorable', () => {
      it('then it should return correct result and not emit anything', async () => {
        const { backendSrv, appEventsMock, expectRequestCallChain } = getTestContext({
          data: { message: 'A message' },
        });
        const url = '/api/dashboard/';
        const result = await backendSrv.request({ url, method: 'DELETE', showSuccessAlert: false });

        expect(result).toEqual({ message: 'A message' });
        expect(appEventsMock.emit).not.toHaveBeenCalled();
        expectRequestCallChain({ url, method: 'DELETE', showSuccessAlert: false });
      });
    });

    describe('when making a successful call and conditions for showSuccessAlert are favorable', () => {
      it('then it should emit correct message', async () => {
        const { backendSrv, appEventsMock, expectRequestCallChain } = getTestContext({
          data: { message: 'A message' },
        });
        const url = '/api/dashboard/';
        const result = await backendSrv.request({ url, method: 'DELETE', showSuccessAlert: true });

        expect(result).toEqual({ message: 'A message' });
        expect(appEventsMock.emit).toHaveBeenCalledTimes(1);
        expect(appEventsMock.emit).toHaveBeenCalledWith(AppEvents.alertSuccess, ['A message']);
        expectRequestCallChain({ url, method: 'DELETE', showSuccessAlert: true });
      });
    });

    describe('when making an unsuccessful call and conditions for retry are favorable and loginPing does not throw', () => {
      it('then it should retry', async () => {
        jest.useFakeTimers();
        const url = '/api/dashboard/';
        const { backendSrv, appEventsMock, logoutMock, expectRequestCallChain } = getTestContext({
          ok: false,
          status: 401,
          statusText: 'UnAuthorized',
          data: { message: 'UnAuthorized' },
          url,
        });

        backendSrv.loginPing = jest
          .fn()
          .mockResolvedValue({ ok: true, status: 200, statusText: 'OK', data: { message: 'Ok' } });

        await backendSrv
          .request({ url, method: 'GET', retry: 0 })
          .catch((error) => {
            expect(error.status).toBe(401);
            expect(error.statusText).toBe('UnAuthorized');
            expect(error.data).toEqual({ message: 'UnAuthorized' });
            expect(appEventsMock.emit).not.toHaveBeenCalled();
            expect(logoutMock).not.toHaveBeenCalled();
            expect(backendSrv.loginPing).toHaveBeenCalledTimes(1);
            expectRequestCallChain({ url, method: 'GET', retry: 0 });
            jest.advanceTimersByTime(50);
          })
          .catch((error) => {
            expect(error).toEqual({ message: 'UnAuthorized' });
            expect(appEventsMock.emit).toHaveBeenCalledTimes(1);
            expect(appEventsMock.emit).toHaveBeenCalledWith(AppEvents.alertWarning, ['UnAuthorized', '']);
          });
      });
    });

    describe('when making an unsuccessful call because of soft token revocation', () => {
      it('then it should dispatch show Token Revoked modal event', async () => {
        const url = '/api/dashboard/';
        const { backendSrv, appEventsMock, logoutMock, expectRequestCallChain } = getTestContext({
          ok: false,
          status: 401,
          statusText: 'UnAuthorized',
          data: { message: 'Token revoked', error: { id: 'ERR_TOKEN_REVOKED', maxConcurrentSessions: 3 } },
          url,
        });

        backendSrv.loginPing = jest.fn();

        await backendSrv.request({ url, method: 'GET', retry: 0 }).catch(() => {
          expect(appEventsMock.publish).toHaveBeenCalledTimes(1);
          expect(appEventsMock.publish).toHaveBeenCalledWith(
            new ShowModalReactEvent({
              component: TokenRevokedModal,
              props: {
                maxConcurrentSessions: 3,
              },
            })
          );
          expect(backendSrv.loginPing).not.toHaveBeenCalled();
          expect(logoutMock).not.toHaveBeenCalled();
          expectRequestCallChain({ url, method: 'GET', retry: 0 });
        });
      });
    });

    describe('when making an unsuccessful call and conditions for retry are favorable and retry throws', () => {
      it('then it throw error', async () => {
        jest.useFakeTimers();
        const { backendSrv, appEventsMock, logoutMock, expectRequestCallChain } = getTestContext({
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
          .request({ url, method: 'GET', retry: 0 })
          .catch((error) => {
            expect(error.status).toBe(403);
            expect(error.statusText).toBe('Forbidden');
            expect(error.data).toEqual({ message: 'Forbidden' });
            expect(appEventsMock.emit).not.toHaveBeenCalled();
            expect(backendSrv.loginPing).toHaveBeenCalledTimes(1);
            expect(logoutMock).not.toHaveBeenCalled();
            expectRequestCallChain({ url, method: 'GET', retry: 0 });
            jest.advanceTimersByTime(50);
          })
          .catch((error) => {
            expect(error).toEqual({ message: 'Forbidden' });
            expect(appEventsMock.emit).toHaveBeenCalledTimes(1);
            expect(appEventsMock.emit).toHaveBeenCalledWith(AppEvents.alertWarning, ['Forbidden', '']);
          });
      });
    });

    describe('when showing error alert', () => {
      describe('when showErrorAlert is undefined and url is a normal api call', () => {
        it('It should emit alert event for normal api errors', async () => {
          const { backendSrv, appEventsMock } = getTestContext({});
          backendSrv.showErrorAlert(
            {
              url: 'api/do/something',
            } as BackendSrvRequest,
            {
              data: {
                message: 'Something failed',
                error: 'Error',
                traceID: 'bogus-trace-id',
              },
            } as FetchError
          );
          expect(appEventsMock.emit).toHaveBeenCalledWith(AppEvents.alertError, [
            'Something failed',
            '',
            'bogus-trace-id',
          ]);
        });
      });
    });

    describe('when making an unsuccessful 422 call', () => {
      it('then it should emit Validation failed message', async () => {
        jest.useFakeTimers();
        const { backendSrv, appEventsMock, logoutMock, expectRequestCallChain } = getTestContext({
          ok: false,
          status: 422,
          statusText: 'Unprocessable Entity',
          data: { message: 'Unprocessable Entity' },
        });
        const url = '/api/dashboard/';

        await backendSrv
          .request({ url, method: 'GET' })
          .catch((error) => {
            expect(error.status).toBe(422);
            expect(error.statusText).toBe('Unprocessable Entity');
            expect(error.data).toEqual({ message: 'Unprocessable Entity' });
            expect(appEventsMock.emit).not.toHaveBeenCalled();
            expect(logoutMock).not.toHaveBeenCalled();
            expectRequestCallChain({ url, method: 'GET' });
            jest.advanceTimersByTime(50);
          })
          .catch((error) => {
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
        const { backendSrv, appEventsMock, logoutMock, expectRequestCallChain } = getTestContext({
          ok: false,
          status: 404,
          statusText: 'Not found',
          data: { message: 'Not found' },
        });
        const url = '/api/dashboard/';

        await backendSrv.request({ url, method: 'GET' }).catch((error) => {
          expect(error.status).toBe(404);
          expect(error.statusText).toBe('Not found');
          expect(error.data).toEqual({ message: 'Not found' });
          expect(appEventsMock.emit).not.toHaveBeenCalled();
          expect(logoutMock).not.toHaveBeenCalled();
          expectRequestCallChain({ url, method: 'GET' });
          error.isHandled = true;
          jest.advanceTimersByTime(50);
          expect(appEventsMock.emit).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('datasourceRequest', () => {
    describe('when called with the same requestId twice', () => {
      it('then it should cancel the first call and the first call should be unsubscribed', async () => {
        const url = '/api/dashboard/';
        const { backendSrv, fromFetchMock } = getTestContext({ url });
        const unsubscribe = jest.fn();
        const slowData = { message: 'Slow Request' };
        const slowFetch = new Observable((subscriber) => {
          subscriber.next({
            ok: true,
            status: 200,
            statusText: 'Ok',
            text: () => Promise.resolve(JSON.stringify(slowData)),
            redirected: false,
            type: 'basic',
            url,
          });
          return unsubscribe;
        }).pipe(delay(10000));

        const fastData = { message: 'Fast Request' };
        const fastFetch = of({
          ok: true,
          status: 200,
          statusText: 'Ok',
          text: () => Promise.resolve(JSON.stringify(fastData)),
          redirected: false,
          type: 'basic',
          url,
        });

        fromFetchMock.mockImplementationOnce(() => slowFetch);
        fromFetchMock.mockImplementation(() => fastFetch);

        const options = {
          url,
          method: 'GET',
          requestId: 'A',
        };

        let slowError: any = null;
        backendSrv.request(options).catch((err) => {
          slowError = err;
        });

        const fastResponse = await backendSrv.request(options);

        expect(fastResponse).toEqual({
          message: 'Fast Request',
        });

        expect(unsubscribe).toHaveBeenCalledTimes(1);

        expect(slowError).toEqual({
          type: DataQueryErrorType.Cancelled,
          cancelled: true,
          data: null,
          status: -1,
          statusText: 'Request was aborted',
          config: options,
        });
      });
    });

    describe('when making an unsuccessful call and conditions for retry are favorable and loginPing does not throw', () => {
      it('then it should retry', async () => {
        const { backendSrv, logoutMock, expectRequestCallChain } = getTestContext({
          ok: false,
          status: 401,
          statusText: 'UnAuthorized',
          data: { message: 'UnAuthorized' },
        });

        backendSrv.loginPing = jest
          .fn()
          .mockResolvedValue({ ok: true, status: 200, statusText: 'OK', data: { message: 'Ok' } });
        const url = '/api/dashboard/';

        let inspectorPacket: any = null;
        backendSrv.getInspectorStream().subscribe({
          next: (rsp) => (inspectorPacket = rsp),
        });

        await backendSrv.datasourceRequest({ url, method: 'GET', retry: 0 }).catch((error) => {
          expect(error.status).toBe(401);
          expect(error.statusText).toBe('UnAuthorized');
          expect(error.data).toEqual({ message: 'UnAuthorized' });
          expect(inspectorPacket).toBe(error);
          expect(backendSrv.loginPing).toHaveBeenCalledTimes(1);
          expect(logoutMock).not.toHaveBeenCalled();
          expectRequestCallChain({ url, method: 'GET', retry: 0 });
        });
      });
    });

    describe('when making an unsuccessful call because of soft token revocation', () => {
      it('then it should dispatch show Token Revoked modal event', async () => {
        const { backendSrv, logoutMock, appEventsMock, expectRequestCallChain } = getTestContext({
          ok: false,
          status: 401,
          statusText: 'UnAuthorized',
          data: { message: 'Token revoked', error: { id: 'ERR_TOKEN_REVOKED', maxConcurrentSessions: 3 } },
        });

        backendSrv.loginPing = jest.fn();

        const url = '/api/dashboard/';

        await backendSrv.datasourceRequest({ url, method: 'GET', retry: 0 }).catch((error) => {
          expect(appEventsMock.publish).toHaveBeenCalledTimes(1);
          expect(appEventsMock.publish).toHaveBeenCalledWith(
            new ShowModalReactEvent({
              component: TokenRevokedModal,
              props: {
                maxConcurrentSessions: 3,
              },
            })
          );
          expect(backendSrv.loginPing).not.toHaveBeenCalled();
          expect(logoutMock).not.toHaveBeenCalled();
          expectRequestCallChain({ url, method: 'GET', retry: 0 });
        });
      });
    });

    describe('when making an unsuccessful call and conditions for retry are favorable and retry throws', () => {
      it('then it throw error', async () => {
        const { backendSrv, logoutMock, expectRequestCallChain } = getTestContext({
          ok: false,
          status: 401,
          statusText: 'UnAuthorized',
          data: { message: 'UnAuthorized' },
        });

        const options = {
          url: '/api/dashboard/',
          method: 'GET',
          retry: 0,
        };

        backendSrv.loginPing = jest
          .fn()
          .mockRejectedValue({ status: 403, statusText: 'Forbidden', data: { message: 'Forbidden' } });

        await backendSrv.datasourceRequest(options).catch((error) => {
          expect(error.status).toBe(403);
          expect(error.statusText).toBe('Forbidden');
          expect(error.data).toEqual({ message: 'Forbidden' });
          expect(backendSrv.loginPing).toHaveBeenCalledTimes(1);
          expect(logoutMock).not.toHaveBeenCalled();
          expectRequestCallChain(options);
        });
      });
    });

    describe('when making an Internal Error call', () => {
      it('then it should throw cancelled error', async () => {
        const { backendSrv, logoutMock, expectRequestCallChain } = getTestContext({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          data: 'Internal Server Error',
        });

        const options = {
          url: '/api/dashboard/',
          method: 'GET',
        };

        await backendSrv.datasourceRequest(options).catch((error) => {
          expect(error).toEqual({
            status: 500,
            statusText: 'Internal Server Error',
            config: options,
            data: {
              error: 'Internal Server Error',
              response: 'Internal Server Error',
              message: 'Internal Server Error',
            },
          });
          expect(logoutMock).not.toHaveBeenCalled();
          expectRequestCallChain(options);
        });
      });
    });

    describe('when formatting prometheus error', () => {
      it('then it should throw cancelled error', async () => {
        const { backendSrv, logoutMock, expectRequestCallChain } = getTestContext({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          data: { error: 'Forbidden' },
        });
        const options = {
          url: '/api/dashboard/',
          method: 'GET',
        };

        let inspectorPacket: any = null;
        backendSrv.getInspectorStream().subscribe({
          next: (rsp) => (inspectorPacket = rsp),
        });

        await backendSrv.datasourceRequest(options).catch((error) => {
          expect(error).toEqual({
            status: 403,
            statusText: 'Forbidden',
            config: options,
            data: {
              error: 'Forbidden',
              message: 'Forbidden',
            },
          });
          expect(inspectorPacket).toEqual(error);
          expect(logoutMock).not.toHaveBeenCalled();
          expectRequestCallChain(options);
        });
      });
    });
  });

  describe('cancelAllInFlightRequests', () => {
    describe('when called with 2 separate requests and then cancelAllInFlightRequests is called', () => {
      const url = '/api/dashboard/';

      const getRequestObservable = (message: string, unsubscribe: any) =>
        new Observable((subscriber) => {
          subscriber.next({
            ok: true,
            status: 200,
            statusText: 'Ok',
            text: () => Promise.resolve(JSON.stringify({ message })),
            headers: {
              map: {
                'content-type': 'application/json',
              },
            },
            redirected: false,
            type: 'basic',
            url,
          });
          return unsubscribe;
        }).pipe(delay(10000));

      it('then it both requests should be cancelled and unsubscribed', async () => {
        const unsubscribe = jest.fn();
        const { backendSrv, fromFetchMock } = getTestContext({ url });
        const firstObservable = getRequestObservable('First', unsubscribe);
        const secondObservable = getRequestObservable('Second', unsubscribe);

        fromFetchMock.mockImplementationOnce(() => firstObservable);
        fromFetchMock.mockImplementation(() => secondObservable);

        const options = {
          url,
          method: 'GET',
        };

        const firstRequest = backendSrv.request(options);
        const secondRequest = backendSrv.request(options);

        backendSrv.cancelAllInFlightRequests();

        let catchedError: any = null;

        try {
          await Promise.all([firstRequest, secondRequest]);
        } catch (err) {
          catchedError = err;
        }

        expect(catchedError.type).toEqual(DataQueryErrorType.Cancelled);
        expect(catchedError.statusText).toEqual('Request was aborted');
        expect(unsubscribe).toHaveBeenCalledTimes(2);
      });
    });
  });
});
