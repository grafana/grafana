import { __awaiter } from "tslib";
import { act, renderHook } from '@testing-library/react';
import { defaultFilters, useSearch } from './useSearch';
describe('useSearch', () => {
    const spans = [
        {
            spanID: 'span1',
            operationName: 'operation1',
            process: {
                serviceName: 'service1',
                tags: [],
            },
            tags: [],
            logs: [],
        },
        {
            spanID: 'span2',
            operationName: 'operation2',
            process: {
                serviceName: 'service2',
                tags: [],
            },
            tags: [],
            logs: [],
        },
    ];
    it('returns matching span IDs', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const { result } = renderHook(() => useSearch(spans));
        act(() => result.current.setSearch(Object.assign(Object.assign({}, defaultFilters), { serviceName: 'service1' })));
        expect((_a = result.current.spanFilterMatches) === null || _a === void 0 ? void 0 : _a.size).toBe(1);
        expect((_b = result.current.spanFilterMatches) === null || _b === void 0 ? void 0 : _b.has('span1')).toBe(true);
    }));
    it('works without spans', () => __awaiter(void 0, void 0, void 0, function* () {
        const { result } = renderHook(() => useSearch());
        act(() => result.current.setSearch(Object.assign(Object.assign({}, defaultFilters), { serviceName: 'service1' })));
        expect(result.current.spanFilterMatches).toBe(undefined);
    }));
});
//# sourceMappingURL=useSearch.test.js.map