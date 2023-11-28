import { __awaiter } from "tslib";
import { renderHook, act } from '@testing-library/react';
import { useHoverIndentGuide } from './useHoverIndentGuide';
describe('useHoverIndentGuide', () => {
    it('adds and removes indent guide ids', () => __awaiter(void 0, void 0, void 0, function* () {
        const { result } = renderHook(() => useHoverIndentGuide());
        expect(result.current.hoverIndentGuideIds.size).toBe(0);
        act(() => result.current.addHoverIndentGuideId('span1'));
        expect(result.current.hoverIndentGuideIds.size).toBe(1);
        expect(result.current.hoverIndentGuideIds.has('span1')).toBe(true);
        act(() => result.current.removeHoverIndentGuideId('span1'));
        expect(result.current.hoverIndentGuideIds.size).toBe(0);
    }));
});
//# sourceMappingURL=useHoverIndentGuide.test.js.map