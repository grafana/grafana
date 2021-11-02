import { __assign, __awaiter, __generator } from "tslib";
import { of } from 'rxjs';
import Api from './api';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { createFetchResponse } from 'test/helpers/createFetchResponse';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
var response = [
    { label: 'test1', value: 'test1' },
    { label: 'test2', value: 'test2' },
];
function getTestContext(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.path, path = _c === void 0 ? 'some-resource' : _c, _d = _b.options, options = _d === void 0 ? {} : _d, _e = _b.response, response = _e === void 0 ? {} : _e, cache = _b.cache;
    return __awaiter(this, void 0, void 0, function () {
        var fetchMock, api, res;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    jest.clearAllMocks();
                    fetchMock = jest.spyOn(backendSrv, 'fetch');
                    fetchMock.mockImplementation(function (options) {
                        var _a;
                        var data = (_a = {}, _a[options.url.match(/([^\/]*)\/*$/)[1].split('?')[0]] = response, _a);
                        return of(createFetchResponse(data));
                    });
                    api = new Api('/cloudmonitoring/');
                    if (cache) {
                        api.cache[path] = cache;
                    }
                    return [4 /*yield*/, api.get(path, options)];
                case 1:
                    res = _f.sent();
                    return [2 /*return*/, { res: res, api: api, fetchMock: fetchMock }];
            }
        });
    });
}
describe('api', function () {
    describe('when resource was cached', function () {
        test.each(['some-resource', 'some-resource?some=param', 'test/some-resource?param'])('should return cached value and not load from source', function (path) { return __awaiter(void 0, void 0, void 0, function () {
            var _a, res, api, fetchMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, getTestContext({ path: path, cache: response })];
                    case 1:
                        _a = _b.sent(), res = _a.res, api = _a.api, fetchMock = _a.fetchMock;
                        expect(res).toEqual(response);
                        expect(api.cache[path]).toEqual(response);
                        expect(fetchMock).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when resource was not cached', function () {
        test.each(['some-resource', 'some-resource?some=param', 'test/some-resource?param'])('should return from source and not from cache', function (path) { return __awaiter(void 0, void 0, void 0, function () {
            var _a, res, api, fetchMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, getTestContext({ path: path, response: response })];
                    case 1:
                        _a = _b.sent(), res = _a.res, api = _a.api, fetchMock = _a.fetchMock;
                        expect(res).toEqual(response);
                        expect(api.cache[path]).toEqual(response);
                        expect(fetchMock).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when cache should be bypassed', function () {
        test.each(['some-resource', 'some-resource?some=param', 'test/some-resource?param'])('should return from source and not from cache', function (path) { return __awaiter(void 0, void 0, void 0, function () {
            var options, _a, res, fetchMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        options = { useCache: false };
                        return [4 /*yield*/, getTestContext({ path: path, response: response, cache: response, options: options })];
                    case 1:
                        _a = _b.sent(), res = _a.res, fetchMock = _a.fetchMock;
                        expect(res).toEqual(response);
                        expect(fetchMock).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=api.test.js.map