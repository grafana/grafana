import { __awaiter, __generator } from "tslib";
import { act, renderHook } from '@testing-library/react-hooks';
import { useDetailState } from './useDetailState';
describe('useDetailState', function () {
    it('toggles detail', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            result = renderHook(function () { return useDetailState(); }).result;
            expect(result.current.detailStates.size).toBe(0);
            act(function () { return result.current.toggleDetail('span1'); });
            expect(result.current.detailStates.size).toBe(1);
            expect(result.current.detailStates.has('span1')).toBe(true);
            act(function () { return result.current.toggleDetail('span1'); });
            expect(result.current.detailStates.size).toBe(0);
            return [2 /*return*/];
        });
    }); });
    it('toggles logs and logs items', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result, log;
        var _a, _b;
        return __generator(this, function (_c) {
            result = renderHook(function () { return useDetailState(); }).result;
            act(function () { return result.current.toggleDetail('span1'); });
            act(function () { return result.current.detailLogsToggle('span1'); });
            expect((_a = result.current.detailStates.get('span1')) === null || _a === void 0 ? void 0 : _a.logs.isOpen).toBe(true);
            log = { timestamp: 1 };
            act(function () { return result.current.detailLogItemToggle('span1', log); });
            expect((_b = result.current.detailStates.get('span1')) === null || _b === void 0 ? void 0 : _b.logs.openedItems.has(log)).toBe(true);
            return [2 /*return*/];
        });
    }); });
    it('toggles warnings', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        var _a;
        return __generator(this, function (_b) {
            result = renderHook(function () { return useDetailState(); }).result;
            act(function () { return result.current.toggleDetail('span1'); });
            act(function () { return result.current.detailWarningsToggle('span1'); });
            expect((_a = result.current.detailStates.get('span1')) === null || _a === void 0 ? void 0 : _a.isWarningsOpen).toBe(true);
            return [2 /*return*/];
        });
    }); });
    it('toggles references', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        var _a;
        return __generator(this, function (_b) {
            result = renderHook(function () { return useDetailState(); }).result;
            act(function () { return result.current.toggleDetail('span1'); });
            act(function () { return result.current.detailReferencesToggle('span1'); });
            expect((_a = result.current.detailStates.get('span1')) === null || _a === void 0 ? void 0 : _a.isReferencesOpen).toBe(true);
            return [2 /*return*/];
        });
    }); });
    it('toggles processes', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        var _a;
        return __generator(this, function (_b) {
            result = renderHook(function () { return useDetailState(); }).result;
            act(function () { return result.current.toggleDetail('span1'); });
            act(function () { return result.current.detailProcessToggle('span1'); });
            expect((_a = result.current.detailStates.get('span1')) === null || _a === void 0 ? void 0 : _a.isProcessOpen).toBe(true);
            return [2 /*return*/];
        });
    }); });
    it('toggles tags', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        var _a;
        return __generator(this, function (_b) {
            result = renderHook(function () { return useDetailState(); }).result;
            act(function () { return result.current.toggleDetail('span1'); });
            act(function () { return result.current.detailTagsToggle('span1'); });
            expect((_a = result.current.detailStates.get('span1')) === null || _a === void 0 ? void 0 : _a.isTagsOpen).toBe(true);
            return [2 /*return*/];
        });
    }); });
});
//# sourceMappingURL=useDetailState.test.js.map