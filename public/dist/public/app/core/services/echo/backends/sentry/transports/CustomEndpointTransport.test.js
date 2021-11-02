import { __assign, __awaiter, __generator, __read } from "tslib";
import { Severity } from '@sentry/browser';
import { Status } from '@sentry/types';
import { CustomEndpointTransport } from './CustomEndpointTransport';
describe('CustomEndpointTransport', function () {
    var fetchSpy = (window.fetch = jest.fn());
    beforeEach(function () { return jest.resetAllMocks(); });
    var now = new Date();
    var event = {
        level: Severity.Error,
        breadcrumbs: [],
        exception: {
            values: [
                {
                    type: 'SomeError',
                    value: 'foo',
                },
            ],
        },
        timestamp: now.getTime() / 1000,
    };
    it('will send received event to backend using window.fetch', function () { return __awaiter(void 0, void 0, void 0, function () {
        var transport, _a, url, reqInit;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    fetchSpy.mockResolvedValue({ status: 200 });
                    transport = new CustomEndpointTransport({ endpoint: '/log' });
                    return [4 /*yield*/, transport.sendEvent(event)];
                case 1:
                    _b.sent();
                    expect(fetchSpy).toHaveBeenCalledTimes(1);
                    _a = __read(fetchSpy.mock.calls[0], 2), url = _a[0], reqInit = _a[1];
                    expect(url).toEqual('/log');
                    expect(reqInit.method).toEqual('POST');
                    expect(reqInit.headers).toEqual({
                        'Content-Type': 'application/json',
                    });
                    expect(JSON.parse(reqInit.body)).toEqual(__assign(__assign({}, event), { timestamp: now.toISOString() }));
                    return [2 /*return*/];
            }
        });
    }); });
    it('will back off if backend returns Retry-After', function () { return __awaiter(void 0, void 0, void 0, function () {
        var rateLimiterResponse, transport;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rateLimiterResponse = {
                        status: 429,
                        ok: false,
                        headers: new Headers({
                            'Retry-After': '1', // 1 second
                        }),
                    };
                    fetchSpy.mockResolvedValueOnce(rateLimiterResponse).mockResolvedValueOnce({ status: 200 });
                    transport = new CustomEndpointTransport({ endpoint: '/log' });
                    // first call - backend is called, rejected because of 429
                    return [4 /*yield*/, expect(transport.sendEvent(event)).rejects.toEqual(rateLimiterResponse)];
                case 1:
                    // first call - backend is called, rejected because of 429
                    _a.sent();
                    expect(fetchSpy).toHaveBeenCalledTimes(1);
                    // second immediate call - shot circuited because retry-after time has not expired, backend not called
                    return [4 /*yield*/, expect(transport.sendEvent(event)).resolves.toHaveProperty('status', Status.Skipped)];
                case 2:
                    // second immediate call - shot circuited because retry-after time has not expired, backend not called
                    _a.sent();
                    expect(fetchSpy).toHaveBeenCalledTimes(1);
                    // wait out the retry-after and call again - great success
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(function () { return resolve(null); }, 1001); })];
                case 3:
                    // wait out the retry-after and call again - great success
                    _a.sent();
                    return [4 /*yield*/, expect(transport.sendEvent(event)).resolves.toBeTruthy()];
                case 4:
                    _a.sent();
                    expect(fetchSpy).toHaveBeenCalledTimes(2);
                    return [2 /*return*/];
            }
        });
    }); });
    it('will back off if backend returns Retry-After', function () { return __awaiter(void 0, void 0, void 0, function () {
        var rateLimiterResponse, transport;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rateLimiterResponse = {
                        status: 429,
                        ok: false,
                        headers: new Headers({
                            'Retry-After': '1', // 1 second
                        }),
                    };
                    fetchSpy.mockResolvedValueOnce(rateLimiterResponse).mockResolvedValueOnce({ status: 200 });
                    transport = new CustomEndpointTransport({ endpoint: '/log' });
                    // first call - backend is called, rejected because of 429
                    return [4 /*yield*/, expect(transport.sendEvent(event)).rejects.toHaveProperty('status', 429)];
                case 1:
                    // first call - backend is called, rejected because of 429
                    _a.sent();
                    expect(fetchSpy).toHaveBeenCalledTimes(1);
                    // second immediate call - shot circuited because retry-after time has not expired, backend not called
                    return [4 /*yield*/, expect(transport.sendEvent(event)).resolves.toHaveProperty('status', Status.Skipped)];
                case 2:
                    // second immediate call - shot circuited because retry-after time has not expired, backend not called
                    _a.sent();
                    expect(fetchSpy).toHaveBeenCalledTimes(1);
                    // wait out the retry-after and call again - great success
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(function () { return resolve(null); }, 1001); })];
                case 3:
                    // wait out the retry-after and call again - great success
                    _a.sent();
                    return [4 /*yield*/, expect(transport.sendEvent(event)).resolves.toBeTruthy()];
                case 4:
                    _a.sent();
                    expect(fetchSpy).toHaveBeenCalledTimes(2);
                    return [2 /*return*/];
            }
        });
    }); });
    it('will drop events if max concurrency is reached', function () { return __awaiter(void 0, void 0, void 0, function () {
        var calls, transport, event2, event3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    calls = [];
                    fetchSpy.mockImplementation(function () {
                        return new Promise(function (resolve) {
                            calls.push(resolve);
                        });
                    });
                    transport = new CustomEndpointTransport({ endpoint: '/log', maxConcurrentRequests: 2 });
                    // first two requests are accepted
                    transport.sendEvent(event);
                    event2 = transport.sendEvent(event);
                    expect(calls).toHaveLength(2);
                    // third is skipped because too many requests in flight
                    return [4 /*yield*/, expect(transport.sendEvent(event)).resolves.toHaveProperty('status', 'skipped')];
                case 1:
                    // third is skipped because too many requests in flight
                    _a.sent();
                    expect(calls).toHaveLength(2);
                    // after resolving in flight requests, next request is accepted as well
                    calls.forEach(function (call) {
                        call({ status: 200 });
                    });
                    return [4 /*yield*/, event2];
                case 2:
                    _a.sent();
                    event3 = transport.sendEvent(event);
                    expect(calls).toHaveLength(3);
                    calls[2]({ status: 200 });
                    return [4 /*yield*/, event3];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=CustomEndpointTransport.test.js.map