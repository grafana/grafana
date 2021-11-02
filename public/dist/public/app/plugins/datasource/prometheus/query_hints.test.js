import { getQueryHints, SUM_HINT_THRESHOLD_COUNT } from './query_hints';
describe('getQueryHints()', function () {
    it('returns no hints for no series', function () {
        expect(getQueryHints('', [])).toEqual([]);
    });
    it('returns no hints for empty series', function () {
        expect(getQueryHints('', [{ datapoints: [] }])).toEqual([]);
    });
    it('returns a rate hint for a counter metric', function () {
        var series = [
            {
                datapoints: [
                    [23, 1000],
                    [24, 1001],
                ],
            },
        ];
        var hints = getQueryHints('metric_total', series);
        expect(hints.length).toBe(1);
        expect(hints[0]).toMatchObject({
            label: 'Metric metric_total looks like a counter.',
            fix: {
                action: {
                    type: 'ADD_RATE',
                    query: 'metric_total',
                },
            },
        });
    });
    it('returns a certain rate hint for a counter metric', function () {
        var series = [
            {
                datapoints: [
                    [23, 1000],
                    [24, 1001],
                ],
            },
        ];
        var mock = { languageProvider: { metricsMetadata: { foo: { type: 'counter' } } } };
        var datasource = mock;
        var hints = getQueryHints('foo', series, datasource);
        expect(hints.length).toBe(1);
        expect(hints[0]).toMatchObject({
            label: 'Metric foo is a counter.',
            fix: {
                action: {
                    type: 'ADD_RATE',
                    query: 'foo',
                },
            },
        });
        // Test substring match not triggering hint
        hints = getQueryHints('foo_foo', series, datasource);
        expect(hints).toEqual([]);
    });
    it('returns no rate hint for a counter metric that already has a rate', function () {
        var series = [
            {
                datapoints: [
                    [23, 1000],
                    [24, 1001],
                ],
            },
        ];
        var hints = getQueryHints('rate(metric_total[1m])', series);
        expect(hints).toEqual([]);
    });
    it('returns no rate hint for a counter metric that already has an increase', function () {
        var series = [
            {
                datapoints: [
                    [23, 1000],
                    [24, 1001],
                ],
            },
        ];
        var hints = getQueryHints('increase(metric_total[1m])', series);
        expect(hints).toEqual([]);
    });
    it('returns a rate hint w/o action for a complex counter metric', function () {
        var series = [
            {
                datapoints: [
                    [23, 1000],
                    [24, 1001],
                ],
            },
        ];
        var hints = getQueryHints('sum(metric_total)', series);
        expect(hints.length).toBe(1);
        expect(hints[0].label).toContain('rate()');
        expect(hints[0].fix).toBeUndefined();
    });
    it('returns a histogram hint for a bucket series', function () {
        var series = [{ datapoints: [[23, 1000]] }];
        var hints = getQueryHints('metric_bucket', series);
        expect(hints.length).toBe(1);
        expect(hints[0]).toMatchObject({
            label: 'Time series has buckets, you probably wanted a histogram.',
            fix: {
                action: {
                    type: 'ADD_HISTOGRAM_QUANTILE',
                    query: 'metric_bucket',
                },
            },
        });
    });
    it('returns a sum hint when many time series results are returned for a simple metric', function () {
        var seriesCount = SUM_HINT_THRESHOLD_COUNT;
        var series = Array.from({ length: seriesCount }, function (_) { return ({
            datapoints: [
                [0, 0],
                [0, 0],
            ],
        }); });
        var hints = getQueryHints('metric', series);
        expect(hints.length).toBe(1);
        expect(hints[0]).toMatchObject({
            type: 'ADD_SUM',
            label: 'Many time series results returned.',
            fix: {
                label: 'Consider aggregating with sum().',
                action: {
                    type: 'ADD_SUM',
                    query: 'metric',
                    preventSubmit: true,
                },
            },
        });
    });
});
//# sourceMappingURL=query_hints.test.js.map