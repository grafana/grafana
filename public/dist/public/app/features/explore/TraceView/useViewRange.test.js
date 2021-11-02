import { __awaiter, __generator } from "tslib";
import { renderHook, act } from '@testing-library/react-hooks';
import { useViewRange } from './useViewRange';
describe('useViewRange', function () {
    it('defaults to full range', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            result = renderHook(function () { return useViewRange(); }).result;
            expect(result.current.viewRange).toEqual({ time: { current: [0, 1] } });
            return [2 /*return*/];
        });
    }); });
    describe('updateNextViewRangeTime', function () {
        it('updates time', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                result = renderHook(function () { return useViewRange(); }).result;
                act(function () { return result.current.updateNextViewRangeTime({ cursor: 0.5 }); });
                expect(result.current.viewRange).toEqual({ time: { current: [0, 1], cursor: 0.5 } });
                return [2 /*return*/];
            });
        }); });
    });
    describe('updateViewRangeTime', function () {
        it('updates time', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                result = renderHook(function () { return useViewRange(); }).result;
                act(function () { return result.current.updateViewRangeTime(0.1, 0.2); });
                expect(result.current.viewRange).toEqual({ time: { current: [0.1, 0.2] } });
                return [2 /*return*/];
            });
        }); });
    });
});
//# sourceMappingURL=useViewRange.test.js.map