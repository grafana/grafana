import { __assign, __awaiter, __generator, __makeTemplateObject } from "tslib";
import 'whatwg-fetch'; // fetch polyfill needed for PhantomJs rendering
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AppEvents, DataQueryErrorType } from '@grafana/data';
import { BackendSrv } from '../services/backend_srv';
import { TokenRevokedModal } from '../../features/users/TokenRevokedModal';
import { ShowModalReactEvent } from '../../types/events';
var getTestContext = function (overides) {
    var defaults = {
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
    var props = __assign(__assign({}, defaults), overides);
    var textMock = jest.fn().mockResolvedValue(JSON.stringify(props.data));
    var fromFetchMock = jest.fn().mockImplementation(function () {
        var mockedResponse = {
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
    var appEventsMock = {
        emit: jest.fn(),
        publish: jest.fn(),
    };
    var user = {
        isSignedIn: props.isSignedIn,
        orgId: props.orgId,
    };
    var contextSrvMock = {
        user: user,
    };
    var logoutMock = jest.fn();
    var parseRequestOptionsMock = jest.fn().mockImplementation(function (options) { return options; });
    var backendSrv = new BackendSrv({
        fromFetch: fromFetchMock,
        appEvents: appEventsMock,
        contextSrv: contextSrvMock,
        logout: logoutMock,
    });
    backendSrv['parseRequestOptions'] = parseRequestOptionsMock;
    var expectCallChain = function (options) {
        expect(fromFetchMock).toHaveBeenCalledTimes(1);
    };
    var expectRequestCallChain = function (options) {
        expect(parseRequestOptionsMock).toHaveBeenCalledTimes(1);
        expect(parseRequestOptionsMock).toHaveBeenCalledWith(options);
        expectCallChain(options);
    };
    return {
        backendSrv: backendSrv,
        fromFetchMock: fromFetchMock,
        appEventsMock: appEventsMock,
        contextSrvMock: contextSrvMock,
        textMock: textMock,
        logoutMock: logoutMock,
        parseRequestOptionsMock: parseRequestOptionsMock,
        expectRequestCallChain: expectRequestCallChain,
    };
};
describe('backendSrv', function () {
    describe('parseRequestOptions', function () {
        it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      retry        | url                                      | headers                           | orgId        | noBackendCache | expected\n      ", " | ", " | ", "                      | ", " | ", "   | ", "\n      ", "         | ", " | ", " | ", "         | ", "        | ", "\n      ", " | ", "                       | ", "                      | ", " | ", "   | ", "\n      ", " | ", "                      | ", "                      | ", " | ", "   | ", "\n      ", " | ", "                     | ", "                      | ", " | ", "   | ", "\n      ", " | ", "                     | ", " | ", " | ", "   | ", "\n      ", " | ", "                     | ", " | ", "         | ", "   | ", "\n      ", " | ", "                     | ", " | ", "         | ", "        | ", "\n      ", "         | ", "                     | ", "                      | ", " | ", "   | ", "\n      ", "         | ", "                     | ", " | ", " | ", "   | ", "\n      ", "         | ", "                     | ", " | ", "         | ", "   | ", "\n      ", "         | ", "                     | ", " | ", "         | ", "        | ", "\n      ", " | ", "               | ", "                      | ", " | ", "   | ", "\n    "], ["\n      retry        | url                                      | headers                           | orgId        | noBackendCache | expected\n      ", " | ", " | ", "                      | ", " | ", "   | ", "\n      ", "         | ", " | ", " | ", "         | ", "        | ", "\n      ", " | ", "                       | ", "                      | ", " | ", "   | ", "\n      ", " | ", "                      | ", "                      | ", " | ", "   | ", "\n      ", " | ", "                     | ", "                      | ", " | ", "   | ", "\n      ", " | ", "                     | ", " | ", " | ", "   | ", "\n      ", " | ", "                     | ", " | ", "         | ", "   | ", "\n      ", " | ", "                     | ", " | ", "         | ", "        | ", "\n      ", "         | ", "                     | ", "                      | ", " | ", "   | ", "\n      ", "         | ", "                     | ", " | ", " | ", "   | ", "\n      ", "         | ", "                     | ", " | ", "         | ", "   | ", "\n      ", "         | ", "                     | ", " | ", "         | ", "        | ", "\n      ", " | ", "               | ", "                      | ", " | ", "   | ", "\n    "])), undefined, 'http://localhost:3000/api/dashboard', undefined, undefined, undefined, { hideFromInspector: false, retry: 0, url: 'http://localhost:3000/api/dashboard' }, 1, 'http://localhost:3000/api/dashboard', { Authorization: 'Some Auth' }, 1, true, { hideFromInspector: false, retry: 1, url: 'http://localhost:3000/api/dashboard', headers: { Authorization: 'Some Auth' } }, undefined, 'api/dashboard', undefined, undefined, undefined, { hideFromInspector: true, retry: 0, url: 'api/dashboard' }, undefined, '/api/dashboard', undefined, undefined, undefined, { hideFromInspector: true, retry: 0, url: 'api/dashboard' }, undefined, '/api/dashboard/', undefined, undefined, undefined, { hideFromInspector: true, retry: 0, url: 'api/dashboard/' }, undefined, '/api/dashboard/', { Authorization: 'Some Auth' }, undefined, undefined, { hideFromInspector: true, retry: 0, url: 'api/dashboard/', headers: { 'X-DS-Authorization': 'Some Auth' } }, undefined, '/api/dashboard/', { Authorization: 'Some Auth' }, 1, undefined, { hideFromInspector: true, retry: 0, url: 'api/dashboard/', headers: { 'X-DS-Authorization': 'Some Auth', 'X-Grafana-Org-Id': 1 } }, undefined, '/api/dashboard/', { Authorization: 'Some Auth' }, 1, true, { hideFromInspector: true, retry: 0, url: 'api/dashboard/', headers: { 'X-DS-Authorization': 'Some Auth', 'X-Grafana-Org-Id': 1, 'X-Grafana-NoCache': 'true' } }, 1, '/api/dashboard/', undefined, undefined, undefined, { hideFromInspector: true, retry: 1, url: 'api/dashboard/' }, 1, '/api/dashboard/', { Authorization: 'Some Auth' }, undefined, undefined, { hideFromInspector: true, retry: 1, url: 'api/dashboard/', headers: { 'X-DS-Authorization': 'Some Auth' } }, 1, '/api/dashboard/', { Authorization: 'Some Auth' }, 1, undefined, { hideFromInspector: true, retry: 1, url: 'api/dashboard/', headers: { 'X-DS-Authorization': 'Some Auth', 'X-Grafana-Org-Id': 1 } }, 1, '/api/dashboard/', { Authorization: 'Some Auth' }, 1, true, { hideFromInspector: true, retry: 1, url: 'api/dashboard/', headers: { 'X-DS-Authorization': 'Some Auth', 'X-Grafana-Org-Id': 1, 'X-Grafana-NoCache': 'true' } }, undefined, 'api/datasources/proxy', undefined, undefined, undefined, { hideFromInspector: false, retry: 0, url: 'api/datasources/proxy' })("when called with retry: '$retry', url: '$url' and orgId: '$orgId' then result should be '$expected'", function (_a) {
            var retry = _a.retry, url = _a.url, headers = _a.headers, orgId = _a.orgId, noBackendCache = _a.noBackendCache, expected = _a.expected;
            return __awaiter(void 0, void 0, void 0, function () {
                var srv;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            srv = new BackendSrv({
                                contextSrv: {
                                    user: {
                                        orgId: orgId,
                                    },
                                },
                            });
                            if (!noBackendCache) return [3 /*break*/, 2];
                            return [4 /*yield*/, srv.withNoBackendCache(function () { return __awaiter(void 0, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        expect(srv['parseRequestOptions']({ retry: retry, url: url, headers: headers })).toEqual(expected);
                                        return [2 /*return*/];
                                    });
                                }); })];
                        case 1:
                            _b.sent();
                            return [3 /*break*/, 3];
                        case 2:
                            expect(srv['parseRequestOptions']({ retry: retry, url: url, headers: headers })).toEqual(expected);
                            _b.label = 3;
                        case 3: return [2 /*return*/];
                    }
                });
            });
        });
    });
    describe('request', function () {
        describe('when making a successful call and conditions for showSuccessAlert are not favorable', function () {
            it('then it should return correct result and not emit anything', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, backendSrv, appEventsMock, expectRequestCallChain, url, result;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = getTestContext({
                                data: { message: 'A message' },
                            }), backendSrv = _a.backendSrv, appEventsMock = _a.appEventsMock, expectRequestCallChain = _a.expectRequestCallChain;
                            url = '/api/dashboard/';
                            return [4 /*yield*/, backendSrv.request({ url: url, method: 'DELETE', showSuccessAlert: false })];
                        case 1:
                            result = _b.sent();
                            expect(result).toEqual({ message: 'A message' });
                            expect(appEventsMock.emit).not.toHaveBeenCalled();
                            expectRequestCallChain({ url: url, method: 'DELETE', showSuccessAlert: false });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when making a successful call and conditions for showSuccessAlert are favorable', function () {
            it('then it should emit correct message', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, backendSrv, appEventsMock, expectRequestCallChain, url, result;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = getTestContext({
                                data: { message: 'A message' },
                            }), backendSrv = _a.backendSrv, appEventsMock = _a.appEventsMock, expectRequestCallChain = _a.expectRequestCallChain;
                            url = '/api/dashboard/';
                            return [4 /*yield*/, backendSrv.request({ url: url, method: 'DELETE', showSuccessAlert: true })];
                        case 1:
                            result = _b.sent();
                            expect(result).toEqual({ message: 'A message' });
                            expect(appEventsMock.emit).toHaveBeenCalledTimes(1);
                            expect(appEventsMock.emit).toHaveBeenCalledWith(AppEvents.alertSuccess, ['A message']);
                            expectRequestCallChain({ url: url, method: 'DELETE', showSuccessAlert: true });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when making an unsuccessful call and conditions for retry are favorable and loginPing does not throw', function () {
            it('then it should retry', function () { return __awaiter(void 0, void 0, void 0, function () {
                var url, _a, backendSrv, appEventsMock, logoutMock, expectRequestCallChain;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            jest.useFakeTimers('modern');
                            url = '/api/dashboard/';
                            _a = getTestContext({
                                ok: false,
                                status: 401,
                                statusText: 'UnAuthorized',
                                data: { message: 'UnAuthorized' },
                                url: url,
                            }), backendSrv = _a.backendSrv, appEventsMock = _a.appEventsMock, logoutMock = _a.logoutMock, expectRequestCallChain = _a.expectRequestCallChain;
                            backendSrv.loginPing = jest
                                .fn()
                                .mockResolvedValue({ ok: true, status: 200, statusText: 'OK', data: { message: 'Ok' } });
                            return [4 /*yield*/, backendSrv
                                    .request({ url: url, method: 'GET', retry: 0 })
                                    .catch(function (error) {
                                    expect(error.status).toBe(401);
                                    expect(error.statusText).toBe('UnAuthorized');
                                    expect(error.data).toEqual({ message: 'UnAuthorized' });
                                    expect(appEventsMock.emit).not.toHaveBeenCalled();
                                    expect(logoutMock).not.toHaveBeenCalled();
                                    expect(backendSrv.loginPing).toHaveBeenCalledTimes(1);
                                    expectRequestCallChain({ url: url, method: 'GET', retry: 0 });
                                    jest.advanceTimersByTime(50);
                                })
                                    .catch(function (error) {
                                    expect(error).toEqual({ message: 'UnAuthorized' });
                                    expect(appEventsMock.emit).toHaveBeenCalledTimes(1);
                                    expect(appEventsMock.emit).toHaveBeenCalledWith(AppEvents.alertWarning, ['UnAuthorized', '']);
                                })];
                        case 1:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when making an unsuccessful call because of soft token revocation', function () {
            it('then it should dispatch show Token Revoked modal event', function () { return __awaiter(void 0, void 0, void 0, function () {
                var url, _a, backendSrv, appEventsMock, logoutMock, expectRequestCallChain;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            url = '/api/dashboard/';
                            _a = getTestContext({
                                ok: false,
                                status: 401,
                                statusText: 'UnAuthorized',
                                data: { message: 'Token revoked', error: { id: 'ERR_TOKEN_REVOKED', maxConcurrentSessions: 3 } },
                                url: url,
                            }), backendSrv = _a.backendSrv, appEventsMock = _a.appEventsMock, logoutMock = _a.logoutMock, expectRequestCallChain = _a.expectRequestCallChain;
                            backendSrv.loginPing = jest.fn();
                            return [4 /*yield*/, backendSrv.request({ url: url, method: 'GET', retry: 0 }).catch(function () {
                                    expect(appEventsMock.publish).toHaveBeenCalledTimes(1);
                                    expect(appEventsMock.publish).toHaveBeenCalledWith(new ShowModalReactEvent({
                                        component: TokenRevokedModal,
                                        props: {
                                            maxConcurrentSessions: 3,
                                        },
                                    }));
                                    expect(backendSrv.loginPing).not.toHaveBeenCalled();
                                    expect(logoutMock).not.toHaveBeenCalled();
                                    expectRequestCallChain({ url: url, method: 'GET', retry: 0 });
                                })];
                        case 1:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when making an unsuccessful call and conditions for retry are favorable and retry throws', function () {
            it('then it throw error', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, backendSrv, appEventsMock, logoutMock, expectRequestCallChain, url;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            jest.useFakeTimers('modern');
                            _a = getTestContext({
                                ok: false,
                                status: 401,
                                statusText: 'UnAuthorized',
                                data: { message: 'UnAuthorized' },
                            }), backendSrv = _a.backendSrv, appEventsMock = _a.appEventsMock, logoutMock = _a.logoutMock, expectRequestCallChain = _a.expectRequestCallChain;
                            backendSrv.loginPing = jest
                                .fn()
                                .mockRejectedValue({ status: 403, statusText: 'Forbidden', data: { message: 'Forbidden' } });
                            url = '/api/dashboard/';
                            return [4 /*yield*/, backendSrv
                                    .request({ url: url, method: 'GET', retry: 0 })
                                    .catch(function (error) {
                                    expect(error.status).toBe(403);
                                    expect(error.statusText).toBe('Forbidden');
                                    expect(error.data).toEqual({ message: 'Forbidden' });
                                    expect(appEventsMock.emit).not.toHaveBeenCalled();
                                    expect(backendSrv.loginPing).toHaveBeenCalledTimes(1);
                                    expect(logoutMock).not.toHaveBeenCalled();
                                    expectRequestCallChain({ url: url, method: 'GET', retry: 0 });
                                    jest.advanceTimersByTime(50);
                                })
                                    .catch(function (error) {
                                    expect(error).toEqual({ message: 'Forbidden' });
                                    expect(appEventsMock.emit).toHaveBeenCalledTimes(1);
                                    expect(appEventsMock.emit).toHaveBeenCalledWith(AppEvents.alertWarning, ['Forbidden', '']);
                                })];
                        case 1:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when showing error alert', function () {
            describe('when showErrorAlert is undefined and url is a normal api call', function () {
                it('It should emit alert event for normal api errors', function () { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, backendSrv, appEventsMock;
                    return __generator(this, function (_b) {
                        _a = getTestContext({}), backendSrv = _a.backendSrv, appEventsMock = _a.appEventsMock;
                        backendSrv.showErrorAlert({
                            url: 'api/do/something',
                        }, {
                            data: {
                                message: 'Something failed',
                                error: 'Error',
                            },
                        });
                        expect(appEventsMock.emit).toHaveBeenCalledWith(AppEvents.alertError, ['Something failed', '']);
                        return [2 /*return*/];
                    });
                }); });
            });
        });
        describe('when making an unsuccessful 422 call', function () {
            it('then it should emit Validation failed message', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, backendSrv, appEventsMock, logoutMock, expectRequestCallChain, url;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            jest.useFakeTimers('modern');
                            _a = getTestContext({
                                ok: false,
                                status: 422,
                                statusText: 'Unprocessable Entity',
                                data: { message: 'Unprocessable Entity' },
                            }), backendSrv = _a.backendSrv, appEventsMock = _a.appEventsMock, logoutMock = _a.logoutMock, expectRequestCallChain = _a.expectRequestCallChain;
                            url = '/api/dashboard/';
                            return [4 /*yield*/, backendSrv
                                    .request({ url: url, method: 'GET' })
                                    .catch(function (error) {
                                    expect(error.status).toBe(422);
                                    expect(error.statusText).toBe('Unprocessable Entity');
                                    expect(error.data).toEqual({ message: 'Unprocessable Entity' });
                                    expect(appEventsMock.emit).not.toHaveBeenCalled();
                                    expect(logoutMock).not.toHaveBeenCalled();
                                    expectRequestCallChain({ url: url, method: 'GET' });
                                    jest.advanceTimersByTime(50);
                                })
                                    .catch(function (error) {
                                    expect(error).toEqual({ message: 'Unprocessable Entity' });
                                    expect(appEventsMock.emit).toHaveBeenCalledTimes(1);
                                    expect(appEventsMock.emit).toHaveBeenCalledWith(AppEvents.alertWarning, [
                                        'Validation failed',
                                        'Unprocessable Entity',
                                    ]);
                                })];
                        case 1:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when making an unsuccessful call and we handle the error', function () {
            it('then it should not emit message', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, backendSrv, appEventsMock, logoutMock, expectRequestCallChain, url;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            jest.useFakeTimers('modern');
                            _a = getTestContext({
                                ok: false,
                                status: 404,
                                statusText: 'Not found',
                                data: { message: 'Not found' },
                            }), backendSrv = _a.backendSrv, appEventsMock = _a.appEventsMock, logoutMock = _a.logoutMock, expectRequestCallChain = _a.expectRequestCallChain;
                            url = '/api/dashboard/';
                            return [4 /*yield*/, backendSrv.request({ url: url, method: 'GET' }).catch(function (error) {
                                    expect(error.status).toBe(404);
                                    expect(error.statusText).toBe('Not found');
                                    expect(error.data).toEqual({ message: 'Not found' });
                                    expect(appEventsMock.emit).not.toHaveBeenCalled();
                                    expect(logoutMock).not.toHaveBeenCalled();
                                    expectRequestCallChain({ url: url, method: 'GET' });
                                    error.isHandled = true;
                                    jest.advanceTimersByTime(50);
                                    expect(appEventsMock.emit).not.toHaveBeenCalled();
                                })];
                        case 1:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('datasourceRequest', function () {
        describe('when called with the same requestId twice', function () {
            it('then it should cancel the first call and the first call should be unsubscribed', function () { return __awaiter(void 0, void 0, void 0, function () {
                var url, _a, backendSrv, fromFetchMock, unsubscribe, slowData, slowFetch, fastData, fastFetch, options, slowError, fastResponse;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            url = '/api/dashboard/';
                            _a = getTestContext({ url: url }), backendSrv = _a.backendSrv, fromFetchMock = _a.fromFetchMock;
                            unsubscribe = jest.fn();
                            slowData = { message: 'Slow Request' };
                            slowFetch = new Observable(function (subscriber) {
                                subscriber.next({
                                    ok: true,
                                    status: 200,
                                    statusText: 'Ok',
                                    text: function () { return Promise.resolve(JSON.stringify(slowData)); },
                                    redirected: false,
                                    type: 'basic',
                                    url: url,
                                });
                                return unsubscribe;
                            }).pipe(delay(10000));
                            fastData = { message: 'Fast Request' };
                            fastFetch = of({
                                ok: true,
                                status: 200,
                                statusText: 'Ok',
                                text: function () { return Promise.resolve(JSON.stringify(fastData)); },
                                redirected: false,
                                type: 'basic',
                                url: url,
                            });
                            fromFetchMock.mockImplementationOnce(function () { return slowFetch; });
                            fromFetchMock.mockImplementation(function () { return fastFetch; });
                            options = {
                                url: url,
                                method: 'GET',
                                requestId: 'A',
                            };
                            slowError = null;
                            backendSrv.request(options).catch(function (err) {
                                slowError = err;
                            });
                            return [4 /*yield*/, backendSrv.request(options)];
                        case 1:
                            fastResponse = _b.sent();
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
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when making an unsuccessful call and conditions for retry are favorable and loginPing does not throw', function () {
            it('then it should retry', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, backendSrv, logoutMock, expectRequestCallChain, url, inspectorPacket;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = getTestContext({
                                ok: false,
                                status: 401,
                                statusText: 'UnAuthorized',
                                data: { message: 'UnAuthorized' },
                            }), backendSrv = _a.backendSrv, logoutMock = _a.logoutMock, expectRequestCallChain = _a.expectRequestCallChain;
                            backendSrv.loginPing = jest
                                .fn()
                                .mockResolvedValue({ ok: true, status: 200, statusText: 'OK', data: { message: 'Ok' } });
                            url = '/api/dashboard/';
                            inspectorPacket = null;
                            backendSrv.getInspectorStream().subscribe({
                                next: function (rsp) { return (inspectorPacket = rsp); },
                            });
                            return [4 /*yield*/, backendSrv.datasourceRequest({ url: url, method: 'GET', retry: 0 }).catch(function (error) {
                                    expect(error.status).toBe(401);
                                    expect(error.statusText).toBe('UnAuthorized');
                                    expect(error.data).toEqual({ message: 'UnAuthorized' });
                                    expect(inspectorPacket).toBe(error);
                                    expect(backendSrv.loginPing).toHaveBeenCalledTimes(1);
                                    expect(logoutMock).not.toHaveBeenCalled();
                                    expectRequestCallChain({ url: url, method: 'GET', retry: 0 });
                                })];
                        case 1:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when making an unsuccessful call because of soft token revocation', function () {
            it('then it should dispatch show Token Revoked modal event', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, backendSrv, logoutMock, appEventsMock, expectRequestCallChain, url;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = getTestContext({
                                ok: false,
                                status: 401,
                                statusText: 'UnAuthorized',
                                data: { message: 'Token revoked', error: { id: 'ERR_TOKEN_REVOKED', maxConcurrentSessions: 3 } },
                            }), backendSrv = _a.backendSrv, logoutMock = _a.logoutMock, appEventsMock = _a.appEventsMock, expectRequestCallChain = _a.expectRequestCallChain;
                            backendSrv.loginPing = jest.fn();
                            url = '/api/dashboard/';
                            return [4 /*yield*/, backendSrv.datasourceRequest({ url: url, method: 'GET', retry: 0 }).catch(function (error) {
                                    expect(appEventsMock.publish).toHaveBeenCalledTimes(1);
                                    expect(appEventsMock.publish).toHaveBeenCalledWith(new ShowModalReactEvent({
                                        component: TokenRevokedModal,
                                        props: {
                                            maxConcurrentSessions: 3,
                                        },
                                    }));
                                    expect(backendSrv.loginPing).not.toHaveBeenCalled();
                                    expect(logoutMock).not.toHaveBeenCalled();
                                    expectRequestCallChain({ url: url, method: 'GET', retry: 0 });
                                })];
                        case 1:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when making an unsuccessful call and conditions for retry are favorable and retry throws', function () {
            it('then it throw error', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, backendSrv, logoutMock, expectRequestCallChain, options;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = getTestContext({
                                ok: false,
                                status: 401,
                                statusText: 'UnAuthorized',
                                data: { message: 'UnAuthorized' },
                            }), backendSrv = _a.backendSrv, logoutMock = _a.logoutMock, expectRequestCallChain = _a.expectRequestCallChain;
                            options = {
                                url: '/api/dashboard/',
                                method: 'GET',
                                retry: 0,
                            };
                            backendSrv.loginPing = jest
                                .fn()
                                .mockRejectedValue({ status: 403, statusText: 'Forbidden', data: { message: 'Forbidden' } });
                            return [4 /*yield*/, backendSrv.datasourceRequest(options).catch(function (error) {
                                    expect(error.status).toBe(403);
                                    expect(error.statusText).toBe('Forbidden');
                                    expect(error.data).toEqual({ message: 'Forbidden' });
                                    expect(backendSrv.loginPing).toHaveBeenCalledTimes(1);
                                    expect(logoutMock).not.toHaveBeenCalled();
                                    expectRequestCallChain(options);
                                })];
                        case 1:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when making an Internal Error call', function () {
            it('then it should throw cancelled error', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, backendSrv, logoutMock, expectRequestCallChain, options;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = getTestContext({
                                ok: false,
                                status: 500,
                                statusText: 'Internal Server Error',
                                data: 'Internal Server Error',
                            }), backendSrv = _a.backendSrv, logoutMock = _a.logoutMock, expectRequestCallChain = _a.expectRequestCallChain;
                            options = {
                                url: '/api/dashboard/',
                                method: 'GET',
                            };
                            return [4 /*yield*/, backendSrv.datasourceRequest(options).catch(function (error) {
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
                                })];
                        case 1:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('when formatting prometheus error', function () {
            it('then it should throw cancelled error', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, backendSrv, logoutMock, expectRequestCallChain, options, inspectorPacket;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = getTestContext({
                                ok: false,
                                status: 403,
                                statusText: 'Forbidden',
                                data: { error: 'Forbidden' },
                            }), backendSrv = _a.backendSrv, logoutMock = _a.logoutMock, expectRequestCallChain = _a.expectRequestCallChain;
                            options = {
                                url: '/api/dashboard/',
                                method: 'GET',
                            };
                            inspectorPacket = null;
                            backendSrv.getInspectorStream().subscribe({
                                next: function (rsp) { return (inspectorPacket = rsp); },
                            });
                            return [4 /*yield*/, backendSrv.datasourceRequest(options).catch(function (error) {
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
                                })];
                        case 1:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('cancelAllInFlightRequests', function () {
        describe('when called with 2 separate requests and then cancelAllInFlightRequests is called', function () {
            var url = '/api/dashboard/';
            var getRequestObservable = function (message, unsubscribe) {
                return new Observable(function (subscriber) {
                    subscriber.next({
                        ok: true,
                        status: 200,
                        statusText: 'Ok',
                        text: function () { return Promise.resolve(JSON.stringify({ message: message })); },
                        headers: {
                            map: {
                                'content-type': 'application/json',
                            },
                        },
                        redirected: false,
                        type: 'basic',
                        url: url,
                    });
                    return unsubscribe;
                }).pipe(delay(10000));
            };
            it('then it both requests should be cancelled and unsubscribed', function () { return __awaiter(void 0, void 0, void 0, function () {
                var unsubscribe, _a, backendSrv, fromFetchMock, firstObservable, secondObservable, options, firstRequest, secondRequest, catchedError, err_1;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            unsubscribe = jest.fn();
                            _a = getTestContext({ url: url }), backendSrv = _a.backendSrv, fromFetchMock = _a.fromFetchMock;
                            firstObservable = getRequestObservable('First', unsubscribe);
                            secondObservable = getRequestObservable('Second', unsubscribe);
                            fromFetchMock.mockImplementationOnce(function () { return firstObservable; });
                            fromFetchMock.mockImplementation(function () { return secondObservable; });
                            options = {
                                url: url,
                                method: 'GET',
                            };
                            firstRequest = backendSrv.request(options);
                            secondRequest = backendSrv.request(options);
                            backendSrv.cancelAllInFlightRequests();
                            catchedError = null;
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, Promise.all([firstRequest, secondRequest])];
                        case 2:
                            _b.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            err_1 = _b.sent();
                            catchedError = err_1;
                            return [3 /*break*/, 4];
                        case 4:
                            expect(catchedError.type).toEqual(DataQueryErrorType.Cancelled);
                            expect(catchedError.statusText).toEqual('Request was aborted');
                            expect(unsubscribe).toHaveBeenCalledTimes(2);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
});
var templateObject_1;
//# sourceMappingURL=backend_srv.test.js.map