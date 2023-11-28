import { __awaiter } from "tslib";
import { renderHook } from '@testing-library/react';
import { DEFAULT_METRICS_QUERY } from '../defaultQueries';
import { migrateAliasPatterns } from './metricQueryMigrations';
import useMigratedMetricsQuery from './useMigratedMetricsQuery';
describe('usePrepareMetricsQuery', () => {
    const DEFAULT_TEST_QUERY = Object.assign(Object.assign({}, DEFAULT_METRICS_QUERY), { refId: 'testId' });
    describe('when there is no label', () => {
        const testQuery = Object.assign(Object.assign({}, DEFAULT_TEST_QUERY), { alias: 'test' });
        it('should replace label with alias and trigger onChangeQuery', () => __awaiter(void 0, void 0, void 0, function* () {
            const expectedQuery = migrateAliasPatterns(testQuery);
            const onChangeQuery = jest.fn();
            const { result } = renderHook(() => useMigratedMetricsQuery(testQuery, onChangeQuery));
            expect(onChangeQuery).toHaveBeenLastCalledWith(result.current);
            expect(result.current).toEqual(expectedQuery);
        }));
    });
    describe('when query has a label', () => {
        const testQuery = Object.assign(Object.assign({}, DEFAULT_TEST_QUERY), { label: 'test' });
        it('should not replace label or trigger onChange', () => __awaiter(void 0, void 0, void 0, function* () {
            const onChangeQuery = jest.fn();
            const { result } = renderHook(() => useMigratedMetricsQuery(testQuery, onChangeQuery));
            expect(result.current).toEqual(testQuery);
            expect(onChangeQuery).toHaveBeenCalledTimes(0);
        }));
    });
});
//# sourceMappingURL=useMigratedMetricsQuery.test.js.map