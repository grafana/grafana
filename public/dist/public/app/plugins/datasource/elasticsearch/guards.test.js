import { isMetricAggregationWithMeta } from './guards';
describe('Type guards', () => {
    test('Identifies metrics with meta attribute', () => {
        const metric = {
            id: 'test',
            type: 'extended_stats',
            meta: {
                test: 'test',
            },
        };
        expect(isMetricAggregationWithMeta(metric)).toBe(true);
    });
    test('Identifies metrics without meta attribute', () => {
        const metric = {
            id: 'test',
            type: 'count',
        };
        expect(isMetricAggregationWithMeta(metric)).toBe(false);
    });
});
//# sourceMappingURL=guards.test.js.map