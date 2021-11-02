import { __assign, __awaiter, __generator, __read } from "tslib";
import { init as initSentry, setUser as sentrySetUser } from '@sentry/browser';
import { SentryEchoBackend } from './SentryBackend';
import { FetchTransport } from '@sentry/browser/dist/transports';
import { CustomEndpointTransport } from './transports/CustomEndpointTransport';
import { EchoSrvTransport } from './transports/EchoSrvTransport';
import { EchoEventType, setEchoSrv } from '@grafana/runtime';
import { waitFor } from '@testing-library/react';
import { Echo } from '../../Echo';
import { GrafanaEdition } from '@grafana/data/src/types/config';
jest.mock('@sentry/browser');
describe('SentryEchoBackend', function () {
    beforeEach(function () { return jest.resetAllMocks(); });
    var buildInfo = {
        version: '1.0',
        commit: 'abcd123',
        isEnterprise: false,
        env: 'production',
        edition: GrafanaEdition.OpenSource,
        latestVersion: 'ba',
        hasUpdate: false,
        hideVersion: false,
    };
    var options = {
        enabled: true,
        buildInfo: buildInfo,
        dsn: 'https://examplePublicKey@o0.ingest.testsentry.io/0',
        sampleRate: 1,
        customEndpoint: '',
        user: {
            email: 'darth.vader@sith.glx',
            id: 504,
            orgId: 1,
        },
    };
    it('will set up sentry`s FetchTransport if DSN is provided', function () { return __awaiter(void 0, void 0, void 0, function () {
        var backend;
        return __generator(this, function (_a) {
            backend = new SentryEchoBackend(options);
            expect(backend.transports.length).toEqual(1);
            expect(backend.transports[0]).toBeInstanceOf(FetchTransport);
            expect(backend.transports[0].options.dsn).toEqual(options.dsn);
            return [2 /*return*/];
        });
    }); });
    it('will set up custom endpoint transport if custom endpoint is provided', function () { return __awaiter(void 0, void 0, void 0, function () {
        var backend;
        return __generator(this, function (_a) {
            backend = new SentryEchoBackend(__assign(__assign({}, options), { dsn: '', customEndpoint: '/log' }));
            expect(backend.transports.length).toEqual(1);
            expect(backend.transports[0]).toBeInstanceOf(CustomEndpointTransport);
            expect(backend.transports[0].options.endpoint).toEqual('/log');
            return [2 /*return*/];
        });
    }); });
    it('will initialize sentry and set user', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            new SentryEchoBackend(options);
            expect(initSentry).toHaveBeenCalledTimes(1);
            expect(initSentry).toHaveBeenCalledWith({
                release: buildInfo.version,
                environment: buildInfo.env,
                dsn: options.dsn,
                sampleRate: options.sampleRate,
                transport: EchoSrvTransport,
                ignoreErrors: [
                    'ResizeObserver loop limit exceeded',
                    'ResizeObserver loop completed',
                    'Non-Error exception captured with keys',
                ],
            });
            expect(sentrySetUser).toHaveBeenCalledWith({
                email: (_a = options.user) === null || _a === void 0 ? void 0 : _a.email,
                id: String((_b = options.user) === null || _b === void 0 ? void 0 : _b.id),
            });
            return [2 /*return*/];
        });
    }); });
    it('will forward events to transports', function () { return __awaiter(void 0, void 0, void 0, function () {
        var backend, event;
        return __generator(this, function (_a) {
            backend = new SentryEchoBackend(options);
            backend.transports = [{ sendEvent: jest.fn() }, { sendEvent: jest.fn() }];
            event = {
                type: EchoEventType.Sentry,
                payload: { foo: 'bar' },
                meta: {},
            };
            backend.addEvent(event);
            backend.transports.forEach(function (transport) {
                expect(transport.sendEvent).toHaveBeenCalledTimes(1);
                expect(transport.sendEvent).toHaveBeenCalledWith(event.payload);
            });
            return [2 /*return*/];
        });
    }); });
    it('integration test with EchoSrv, Sentry and CustomFetchTransport', function () { return __awaiter(void 0, void 0, void 0, function () {
        var sentry, fetchSpy, echo, sentryBackend, myCustomErrorBackend, error, _a, url, reqInit;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    sentry = jest.requireActual('@sentry/browser');
                    initSentry.mockImplementation(sentry.init);
                    sentrySetUser.mockImplementation(sentry.setUser);
                    fetchSpy = (window.fetch = jest.fn());
                    fetchSpy.mockResolvedValue({ status: 200 });
                    echo = new Echo({ debug: true });
                    setEchoSrv(echo);
                    sentryBackend = new SentryEchoBackend(__assign(__assign({}, options), { dsn: '', customEndpoint: '/log' }));
                    echo.addBackend(sentryBackend);
                    myCustomErrorBackend = {
                        supportedEvents: [EchoEventType.Sentry],
                        flush: function () { },
                        options: {},
                        addEvent: jest.fn(),
                    };
                    echo.addBackend(myCustomErrorBackend);
                    error = new Error('test error');
                    window.onerror(error.message, undefined, undefined, undefined, error);
                    // check that error was reported to backend
                    return [4 /*yield*/, waitFor(function () { return expect(fetchSpy).toHaveBeenCalledTimes(1); })];
                case 1:
                    // check that error was reported to backend
                    _b.sent();
                    _a = __read(fetchSpy.mock.calls[0], 2), url = _a[0], reqInit = _a[1];
                    expect(url).toEqual('/log');
                    expect(JSON.parse(reqInit.body).exception.values[0].value).toEqual('test error');
                    // check that our custom backend got it too
                    expect(myCustomErrorBackend.addEvent).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=SentryBackend.test.js.map