import { __awaiter, __generator } from "tslib";
import { act, renderHook } from '@testing-library/react-hooks';
import { useSearch } from './useSearch';
describe('useSearch', function () {
    it('returns matching span IDs', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        var _a, _b;
        return __generator(this, function (_c) {
            result = renderHook(function () {
                return useSearch([
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
                ]);
            }).result;
            act(function () { return result.current.setSearch('service1'); });
            expect((_a = result.current.spanFindMatches) === null || _a === void 0 ? void 0 : _a.size).toBe(1);
            expect((_b = result.current.spanFindMatches) === null || _b === void 0 ? void 0 : _b.has('span1')).toBe(true);
            return [2 /*return*/];
        });
    }); });
    it('works without spans', function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            result = renderHook(function () { return useSearch(); }).result;
            act(function () { return result.current.setSearch('service1'); });
            expect(result.current.spanFindMatches).toBe(undefined);
            return [2 /*return*/];
        });
    }); });
});
//# sourceMappingURL=useSearch.test.js.map