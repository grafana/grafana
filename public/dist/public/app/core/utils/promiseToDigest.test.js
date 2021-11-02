import { __awaiter, __generator } from "tslib";
import { promiseToDigest } from './promiseToDigest';
describe('promiseToDigest', function () {
    describe('when called with a promise that resolves', function () {
        it('then evalAsync should be called on $scope', function () { return __awaiter(void 0, void 0, void 0, function () {
            var $scope;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        $scope = { $evalAsync: jest.fn() };
                        return [4 /*yield*/, promiseToDigest($scope)(Promise.resolve(123))];
                    case 1:
                        _a.sent();
                        expect($scope.$evalAsync).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called with a promise that rejects', function () {
        it('then evalAsync should be called on $scope', function () { return __awaiter(void 0, void 0, void 0, function () {
            var $scope, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        $scope = { $evalAsync: jest.fn() };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, promiseToDigest($scope)(Promise.reject(123))];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        expect(error_1).toEqual(123);
                        expect($scope.$evalAsync).toHaveBeenCalledTimes(1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=promiseToDigest.test.js.map