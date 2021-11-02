import { __awaiter, __generator } from "tslib";
import { renderHook, act } from '@testing-library/react-hooks';
import { useHoverIndentGuide } from './useHoverIndentGuide';
describe('useHoverIndentGuide', function () {
    it('adds and removes indent guide ids', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            result = renderHook(function () { return useHoverIndentGuide(); }).result;
            expect(result.current.hoverIndentGuideIds.size).toBe(0);
            act(function () { return result.current.addHoverIndentGuideId('span1'); });
            expect(result.current.hoverIndentGuideIds.size).toBe(1);
            expect(result.current.hoverIndentGuideIds.has('span1')).toBe(true);
            act(function () { return result.current.removeHoverIndentGuideId('span1'); });
            expect(result.current.hoverIndentGuideIds.size).toBe(0);
            return [2 /*return*/];
        });
    }); });
});
//# sourceMappingURL=useHoverIndentGuide.test.js.map