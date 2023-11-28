import { __awaiter } from "tslib";
import { act, renderHook } from '@testing-library/react';
import { useDetailState } from './useDetailState';
const sampleFrame = {
    name: 'trace',
    fields: [],
    length: 0,
};
describe('useDetailState', () => {
    it('toggles detail', () => __awaiter(void 0, void 0, void 0, function* () {
        const { result } = renderHook(() => useDetailState(sampleFrame));
        expect(result.current.detailStates.size).toBe(0);
        act(() => result.current.toggleDetail('span1'));
        expect(result.current.detailStates.size).toBe(1);
        expect(result.current.detailStates.has('span1')).toBe(true);
        act(() => result.current.toggleDetail('span1'));
        expect(result.current.detailStates.size).toBe(0);
    }));
    it('toggles logs and logs items', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const { result } = renderHook(() => useDetailState(sampleFrame));
        act(() => result.current.toggleDetail('span1'));
        act(() => result.current.detailLogsToggle('span1'));
        expect((_a = result.current.detailStates.get('span1')) === null || _a === void 0 ? void 0 : _a.logs.isOpen).toBe(true);
        const log = { timestamp: 1, fields: [] };
        act(() => result.current.detailLogItemToggle('span1', log));
        expect((_b = result.current.detailStates.get('span1')) === null || _b === void 0 ? void 0 : _b.logs.openedItems.has(log)).toBe(true);
    }));
    it('toggles warnings', () => __awaiter(void 0, void 0, void 0, function* () {
        var _c;
        const { result } = renderHook(() => useDetailState(sampleFrame));
        act(() => result.current.toggleDetail('span1'));
        act(() => result.current.detailWarningsToggle('span1'));
        expect((_c = result.current.detailStates.get('span1')) === null || _c === void 0 ? void 0 : _c.isWarningsOpen).toBe(true);
    }));
    it('toggles references', () => __awaiter(void 0, void 0, void 0, function* () {
        var _d;
        const { result } = renderHook(() => useDetailState(sampleFrame));
        act(() => result.current.toggleDetail('span1'));
        act(() => result.current.detailReferencesToggle('span1'));
        expect((_d = result.current.detailStates.get('span1')) === null || _d === void 0 ? void 0 : _d.references.isOpen).toBe(true);
    }));
    it('toggles processes', () => __awaiter(void 0, void 0, void 0, function* () {
        var _e;
        const { result } = renderHook(() => useDetailState(sampleFrame));
        act(() => result.current.toggleDetail('span1'));
        act(() => result.current.detailProcessToggle('span1'));
        expect((_e = result.current.detailStates.get('span1')) === null || _e === void 0 ? void 0 : _e.isProcessOpen).toBe(true);
    }));
    it('toggles tags', () => __awaiter(void 0, void 0, void 0, function* () {
        var _f;
        const { result } = renderHook(() => useDetailState(sampleFrame));
        act(() => result.current.toggleDetail('span1'));
        act(() => result.current.detailTagsToggle('span1'));
        expect((_f = result.current.detailStates.get('span1')) === null || _f === void 0 ? void 0 : _f.isTagsOpen).toBe(true);
    }));
});
//# sourceMappingURL=useDetailState.test.js.map