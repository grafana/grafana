import { __awaiter } from "tslib";
import { promiseToDigest } from './promiseToDigest';
describe('promiseToDigest', () => {
    describe('when called with a promise that resolves', () => {
        it('then evalAsync should be called on $scope', () => __awaiter(void 0, void 0, void 0, function* () {
            const $scope = { $evalAsync: jest.fn() };
            yield promiseToDigest($scope)(Promise.resolve(123));
            expect($scope.$evalAsync).toHaveBeenCalledTimes(1);
        }));
    });
    describe('when called with a promise that rejects', () => {
        it('then evalAsync should be called on $scope', () => __awaiter(void 0, void 0, void 0, function* () {
            const $scope = { $evalAsync: jest.fn() };
            try {
                yield promiseToDigest($scope)(Promise.reject(123));
            }
            catch (error) {
                expect(error).toEqual(123);
                expect($scope.$evalAsync).toHaveBeenCalledTimes(1);
            }
        }));
    });
});
//# sourceMappingURL=promiseToDigest.test.js.map