import { __awaiter, __generator } from "tslib";
import { renderHook, act } from '@testing-library/react-hooks';
import { useChildrenState } from './useChildrenState';
describe('useChildrenState', function () {
    describe('childrenToggle', function () {
        it('toggles children state', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                result = renderHook(function () { return useChildrenState(); }).result;
                expect(result.current.childrenHiddenIDs.size).toBe(0);
                act(function () { return result.current.childrenToggle('testId'); });
                expect(result.current.childrenHiddenIDs.size).toBe(1);
                expect(result.current.childrenHiddenIDs.has('testId')).toBe(true);
                act(function () { return result.current.childrenToggle('testId'); });
                expect(result.current.childrenHiddenIDs.size).toBe(0);
                return [2 /*return*/];
            });
        }); });
    });
    describe('expandAll', function () {
        it('expands all', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                result = renderHook(function () { return useChildrenState(); }).result;
                act(function () { return result.current.childrenToggle('testId1'); });
                act(function () { return result.current.childrenToggle('testId2'); });
                expect(result.current.childrenHiddenIDs.size).toBe(2);
                act(function () { return result.current.expandAll(); });
                expect(result.current.childrenHiddenIDs.size).toBe(0);
                return [2 /*return*/];
            });
        }); });
    });
    describe('collapseAll', function () {
        it('hides spans that have children', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                result = renderHook(function () { return useChildrenState(); }).result;
                act(function () {
                    return result.current.collapseAll([
                        { spanID: 'span1', hasChildren: true },
                        { spanID: 'span2', hasChildren: false },
                    ]);
                });
                expect(result.current.childrenHiddenIDs.size).toBe(1);
                expect(result.current.childrenHiddenIDs.has('span1')).toBe(true);
                return [2 /*return*/];
            });
        }); });
        it('does nothing if already collapsed', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                result = renderHook(function () { return useChildrenState(); }).result;
                act(function () { return result.current.childrenToggle('span1'); });
                act(function () {
                    return result.current.collapseAll([
                        { spanID: 'span1', hasChildren: true },
                        { spanID: 'span2', hasChildren: false },
                    ]);
                });
                expect(result.current.childrenHiddenIDs.size).toBe(1);
                expect(result.current.childrenHiddenIDs.has('span1')).toBe(true);
                return [2 /*return*/];
            });
        }); });
    });
    // Other function are not yet used.
});
//# sourceMappingURL=useChildrenState.test.js.map