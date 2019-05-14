var _this = this;
import * as tslib_1 from "tslib";
import { BackendSrv } from 'app/core/services/backend_srv';
jest.mock('app/core/store');
describe('backend_srv', function () {
    var _httpBackend = function (options) {
        if (options.url === 'gateway-error') {
            return Promise.reject({ status: 502 });
        }
        return Promise.resolve({});
    };
    var _backendSrv = new BackendSrv(_httpBackend, {}, {}, {});
    describe('when handling errors', function () {
        it('should return the http status code', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var err_1;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, _backendSrv.datasourceRequest({
                                url: 'gateway-error',
                            })];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        err_1 = _a.sent();
                        expect(err_1.status).toBe(502);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=backend_srv.test.js.map