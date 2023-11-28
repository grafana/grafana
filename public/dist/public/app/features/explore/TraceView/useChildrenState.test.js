import { __awaiter } from "tslib";
import { renderHook, act } from '@testing-library/react';
import { useChildrenState } from './useChildrenState';
describe('useChildrenState', () => {
    describe('childrenToggle', () => {
        it('toggles children state', () => __awaiter(void 0, void 0, void 0, function* () {
            const { result } = renderHook(() => useChildrenState());
            expect(result.current.childrenHiddenIDs.size).toBe(0);
            act(() => result.current.childrenToggle('testId'));
            expect(result.current.childrenHiddenIDs.size).toBe(1);
            expect(result.current.childrenHiddenIDs.has('testId')).toBe(true);
            act(() => result.current.childrenToggle('testId'));
            expect(result.current.childrenHiddenIDs.size).toBe(0);
        }));
    });
    describe('expandAll', () => {
        it('expands all', () => __awaiter(void 0, void 0, void 0, function* () {
            const { result } = renderHook(() => useChildrenState());
            act(() => result.current.childrenToggle('testId1'));
            act(() => result.current.childrenToggle('testId2'));
            expect(result.current.childrenHiddenIDs.size).toBe(2);
            act(() => result.current.expandAll());
            expect(result.current.childrenHiddenIDs.size).toBe(0);
        }));
    });
    describe('collapseAll', () => {
        it('hides spans that have children', () => __awaiter(void 0, void 0, void 0, function* () {
            const { result } = renderHook(() => useChildrenState());
            act(() => result.current.collapseAll([
                { spanID: 'span1', hasChildren: true },
                { spanID: 'span2', hasChildren: false },
            ]));
            expect(result.current.childrenHiddenIDs.size).toBe(1);
            expect(result.current.childrenHiddenIDs.has('span1')).toBe(true);
        }));
        it('does nothing if already collapsed', () => __awaiter(void 0, void 0, void 0, function* () {
            const { result } = renderHook(() => useChildrenState());
            act(() => result.current.childrenToggle('span1'));
            act(() => result.current.collapseAll([
                { spanID: 'span1', hasChildren: true },
                { spanID: 'span2', hasChildren: false },
            ]));
            expect(result.current.childrenHiddenIDs.size).toBe(1);
            expect(result.current.childrenHiddenIDs.has('span1')).toBe(true);
        }));
    });
    // Other function are not yet used.
});
//# sourceMappingURL=useChildrenState.test.js.map