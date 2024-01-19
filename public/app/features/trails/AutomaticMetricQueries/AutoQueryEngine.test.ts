import { getAutoQueriesForMetric } from './AutoQueryEngine';

function expandExpr(shortenedExpr: string) {
  return shortenedExpr.replace('...', '${metric}{${filters}}');
}

describe('getAutoQueriesForMetric', () => {
  describe('Consider result.main query (only first)', () => {
    it.each([
      // no rate
      ['my_metric_general', 'avg(...)', 'short', 1],
      ['my_metric_bytes', 'avg(...)', 'bytes', 1],
      ['my_metric_seconds', 'avg(...)', 's', 1],
      // rate with counts per second
      ['my_metric_count', 'sum(rate(...[$__rate_interval]))', 'cps', 1], // cps = counts per second
      ['my_metric_total', 'sum(rate(...[$__rate_interval]))', 'cps', 1],
      ['my_metric_seconds_count', 'sum(rate(...[$__rate_interval]))', 'cps', 1],
      // rate with seconds per second
      ['my_metric_seconds_total', 'sum(rate(...[$__rate_interval]))', 'short', 1], // s/s
      ['my_metric_seconds_sum', 'avg(rate(...[$__rate_interval]))', 'short', 1],
      // rate with bytes per second
      ['my_metric_bytes_total', 'sum(rate(...[$__rate_interval]))', 'Bps', 1], // bytes/s
      ['my_metric_bytes_sum', 'avg(rate(...[$__rate_interval]))', 'Bps', 1],
      // Bucket
      ['my_metric_bucket', 'histogram_quantile(0.99, sum by(le) (rate(...[$__rate_interval])))', 'short', 3],
      ['my_metric_seconds_bucket', 'histogram_quantile(0.99, sum by(le) (rate(...[$__rate_interval])))', 's', 3],
      ['my_metric_bytes_bucket', 'histogram_quantile(0.99, sum by(le) (rate(...[$__rate_interval])))', 'bytes', 3],
    ])('Given metric %p expect %p with unit %p', (metric, expr, unit, queryCount) => {
      const result = getAutoQueriesForMetric(metric);

      const queryDef = result.main;

      const expected = { expr: expandExpr(expr), unit, queryCount };
      const actual = { expr: queryDef.queries[0].expr, unit: queryDef.unit, queryCount: queryDef.queries.length };

      expect(actual).toStrictEqual(expected);
    });
  });

  describe('Consider result.preview query (only first)', () => {
    it.each([
      // no rate
      ['my_metric_general', 'avg(...)', 'short'],
      ['my_metric_bytes', 'avg(...)', 'bytes'],
      ['my_metric_seconds', 'avg(...)', 's'],
      // rate with counts per second
      ['my_metric_count', 'sum(rate(...[$__rate_interval]))', 'cps'], // cps = counts per second
      ['my_metric_total', 'sum(rate(...[$__rate_interval]))', 'cps'],
      ['my_metric_seconds_count', 'sum(rate(...[$__rate_interval]))', 'cps'],
      // rate with seconds per second
      ['my_metric_seconds_total', 'sum(rate(...[$__rate_interval]))', 'short'], // s/s
      ['my_metric_seconds_sum', 'avg(rate(...[$__rate_interval]))', 'short'],
      // rate with bytes per second
      ['my_metric_bytes_total', 'sum(rate(...[$__rate_interval]))', 'Bps'], // bytes/s
      ['my_metric_bytes_sum', 'avg(rate(...[$__rate_interval]))', 'Bps'],
      // Bucket
      ['my_metric_bucket', 'histogram_quantile(0.5, sum by(le) (rate(...[$__rate_interval])))', 'short'],
      ['my_metric_seconds_bucket', 'histogram_quantile(0.5, sum by(le) (rate(...[$__rate_interval])))', 's'],
      ['my_metric_bytes_bucket', 'histogram_quantile(0.5, sum by(le) (rate(...[$__rate_interval])))', 'bytes'],
    ])('Given metric %p expect %p with unit %p', (metric, expr, unit) => {
      const result = getAutoQueriesForMetric(metric);

      const queryDef = result.preview;

      const queryCount = 1;

      const expected = { expr: expandExpr(expr), unit, queryCount };
      const actual = { expr: queryDef.queries[0].expr, unit: queryDef.unit, queryCount: queryDef.queries.length };

      expect(actual).toStrictEqual(expected);
    });
  });

  describe('Consider result.breakdown query (only first)', () => {
    it.each([
      // no rate
      ['my_metric_general', 'avg(...) by(${groupby})', 'short'],
      ['my_metric_bytes', 'avg(...) by(${groupby})', 'bytes'],
      ['my_metric_seconds', 'avg(...) by(${groupby})', 's'],
      // rate with counts per second
      ['my_metric_count', 'sum(rate(...[$__rate_interval])) by(${groupby})', 'cps'], // cps = counts per second
      ['my_metric_total', 'sum(rate(...[$__rate_interval])) by(${groupby})', 'cps'],
      ['my_metric_seconds_count', 'sum(rate(...[$__rate_interval])) by(${groupby})', 'cps'],
      // rate with seconds per second
      ['my_metric_seconds_total', 'sum(rate(...[$__rate_interval])) by(${groupby})', 'short'], // s/s
      ['my_metric_seconds_sum', 'avg(rate(...[$__rate_interval])) by(${groupby})', 'short'],
      // rate with bytes per second
      ['my_metric_bytes_total', 'sum(rate(...[$__rate_interval])) by(${groupby})', 'Bps'], // bytes/s
      ['my_metric_bytes_sum', 'avg(rate(...[$__rate_interval])) by(${groupby})', 'Bps'],
      // Bucket
      ['my_metric_bucket', 'histogram_quantile(0.5, sum by(le, ${groupby}) (rate(...[$__rate_interval])))', 'short'],
      [
        'my_metric_seconds_bucket',
        'histogram_quantile(0.5, sum by(le, ${groupby}) (rate(...[$__rate_interval])))',
        's',
      ],
      [
        'my_metric_bytes_bucket',
        'histogram_quantile(0.5, sum by(le, ${groupby}) (rate(...[$__rate_interval])))',
        'bytes',
      ],
    ])('Given metric %p expect %p with unit %p', (metric, expr, unit) => {
      const result = getAutoQueriesForMetric(metric);

      const queryDef = result.breakdown;

      const queryCount = 1;

      const expected = { expr: expandExpr(expr), unit, queryCount };
      const actual = { expr: queryDef.queries[0].expr, unit: queryDef.unit, queryCount: queryDef.queries.length };

      expect(actual).toStrictEqual(expected);
    });
  });

  describe('Consider result.variant', () => {
    it.each([
      // No variants
      ['my_metric_count', []],
      ['my_metric_seconds_count', []],
      ['my_metric_bytes', []],
      ['my_metric_seconds', []],
      ['my_metric_general', []],
      ['my_metric_seconds_total', []],
      ['my_metric_seconds_sum', []],
      // Bucket variants
      [
        'my_metric_bucket',
        [
          {
            variant: 'percentiles',
            unit: 'short',
            exprs: [
              'histogram_quantile(0.99, sum by(le) (rate(${metric}{${filters}}[$__rate_interval])))',
              'histogram_quantile(0.9, sum by(le) (rate(${metric}{${filters}}[$__rate_interval])))',
              'histogram_quantile(0.5, sum by(le) (rate(${metric}{${filters}}[$__rate_interval])))',
            ],
          },
          {
            variant: 'heatmap',
            unit: 'short',
            exprs: ['sum by(le) (rate(${metric}{${filters}}[$__rate_interval]))'],
          },
        ],
      ],
      [
        'my_metric_seconds_bucket',
        [
          {
            variant: 'percentiles',
            unit: 's',
            exprs: [
              'histogram_quantile(0.99, sum by(le) (rate(${metric}{${filters}}[$__rate_interval])))',
              'histogram_quantile(0.9, sum by(le) (rate(${metric}{${filters}}[$__rate_interval])))',
              'histogram_quantile(0.5, sum by(le) (rate(${metric}{${filters}}[$__rate_interval])))',
            ],
          },
          {
            variant: 'heatmap',
            unit: 's',
            exprs: ['sum by(le) (rate(${metric}{${filters}}[$__rate_interval]))'],
          },
        ],
      ],
      [
        'my_metric_bytes_bucket',
        [
          {
            variant: 'percentiles',
            unit: 'bytes',
            exprs: [
              'histogram_quantile(0.99, sum by(le) (rate(${metric}{${filters}}[$__rate_interval])))',
              'histogram_quantile(0.9, sum by(le) (rate(${metric}{${filters}}[$__rate_interval])))',
              'histogram_quantile(0.5, sum by(le) (rate(${metric}{${filters}}[$__rate_interval])))',
            ],
          },
          {
            variant: 'heatmap',
            unit: 'bytes',
            exprs: ['sum by(le) (rate(${metric}{${filters}}[$__rate_interval]))'],
          },
        ],
      ],
    ])('Given metric %p should generate expected variants', (metric, expectedVariants) => {
      const defs = getAutoQueriesForMetric(metric);

      const received = defs.variants.map((variant) => ({
        variant: variant.variant,
        unit: variant.unit,
        exprs: variant.queries.map((query) => query.expr),
      }));

      expect(received).toStrictEqual(expectedVariants);
    });
  });

  describe('Able to handle unconventional metric names', () => {
    it.each([['PRODUCT_High_Priority_items_', 'avg(...)', 'short', 1]])(
      'Given metric %p expect %p with unit %p',
      (metric, expr, unit, queryCount) => {
        const result = getAutoQueriesForMetric(metric);

        const queryDef = result.main;

        const expected = { expr: expandExpr(expr), unit, queryCount };
        const actual = { expr: queryDef.queries[0].expr, unit: queryDef.unit, queryCount: queryDef.queries.length };

        expect(actual).toStrictEqual(expected);
      }
    );
  });
});
