import { getQueryHints, SUM_HINT_THRESHOLD_COUNT } from '../query_hints';
describe('getQueryHints()', function () {
    it('returns no hints for no series', function () {
        expect(getQueryHints('', [])).toEqual(null);
    });
    it('returns no hints for empty series', function () {
        expect(getQueryHints('', [{ datapoints: [] }])).toEqual(null);
    });
    it('returns no hint for a monotonously decreasing series', function () {
        var series = [{ datapoints: [[23, 1000], [22, 1001]] }];
        var hints = getQueryHints('metric', series);
        expect(hints).toEqual(null);
    });
    it('returns no hint for a flat series', function () {
        var series = [{ datapoints: [[null, 1000], [23, 1001], [null, 1002], [23, 1003]] }];
        var hints = getQueryHints('metric', series);
        expect(hints).toEqual(null);
    });
    it('returns a rate hint for a monotonously increasing series', function () {
        var series = [{ datapoints: [[23, 1000], [24, 1001]] }];
        var hints = getQueryHints('metric', series);
        expect(hints.length).toBe(1);
        expect(hints[0]).toMatchObject({
            label: 'Time series is monotonously increasing.',
            fix: {
                action: {
                    type: 'ADD_RATE',
                    query: 'metric',
                },
            },
        });
    });
    it('returns no rate hint for a monotonously increasing series that already has a rate', function () {
        var series = [{ datapoints: [[23, 1000], [24, 1001]] }];
        var hints = getQueryHints('rate(metric[1m])', series);
        expect(hints).toEqual(null);
    });
    it('returns a rate hint w/o action for a complex monotonously increasing series', function () {
        var series = [{ datapoints: [[23, 1000], [24, 1001]] }];
        var hints = getQueryHints('sum(metric)', series);
        expect(hints.length).toBe(1);
        expect(hints[0].label).toContain('rate()');
        expect(hints[0].fix).toBeUndefined();
    });
    it('returns a rate hint for a monotonously increasing series with missing data', function () {
        var series = [{ datapoints: [[23, 1000], [null, 1001], [24, 1002]] }];
        var hints = getQueryHints('metric', series);
        expect(hints.length).toBe(1);
        expect(hints[0]).toMatchObject({
            label: 'Time series is monotonously increasing.',
            fix: {
                action: {
                    type: 'ADD_RATE',
                    query: 'metric',
                },
            },
        });
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
            datapoints: [[0, 0], [0, 0]],
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