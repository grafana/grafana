import { VAR_FILTERS_EXPR, VAR_METRIC_EXPR, VAR_OTEL_JOIN_QUERY_EXPR } from '../shared';

import { getAutoQueriesForMetric } from './getAutoQueriesForMetric';
import { generateBaseQuery } from './queryGenerators/baseQuery';

function expandExpr(shortenedExpr: string) {
  return shortenedExpr.replace('...', '${metric}{${filters}}');
}

const otelJoinQuery = '${otel_join_query}';

describe('getAutoQueriesForMetric', () => {
  describe('for the summary/histogram types', () => {
    const etc = '{${filters}}[$__rate_interval]';
    const byGroup = 'by(${groupby})';

    describe('metrics with _sum suffix', () => {
      const result = getAutoQueriesForMetric('SUM_OR_HIST_sum');

      test('main query is the mean', () => {
        const [{ expr }] = result.main.queries;
        const mean = `sum(rate(SUM_OR_HIST_sum${etc}) ${otelJoinQuery})/sum(rate(SUM_OR_HIST_count${etc}) ${otelJoinQuery})`;

        expect(expr).toBe(mean);
      });

      test('preview query is the mean', () => {
        const [{ expr }] = result.preview.queries;
        const mean = `sum(rate(SUM_OR_HIST_sum${etc}) ${otelJoinQuery})/sum(rate(SUM_OR_HIST_count${etc}) ${otelJoinQuery})`;
        expect(expr).toBe(mean);
      });

      test('breakdown query is the mean by group', () => {
        const [{ expr }] = result.breakdown.queries;
        const meanBreakdown = `sum(rate(SUM_OR_HIST_sum${etc}) ${otelJoinQuery})${byGroup}/sum(rate(SUM_OR_HIST_count${etc}) ${otelJoinQuery})${byGroup}`;
        expect(expr).toBe(meanBreakdown);
      });

      test('there are no variants', () => {
        expect(result.variants.length).toBe(0);
      });
    });

    describe('metrics with _count suffix', () => {
      const result = getAutoQueriesForMetric('SUM_OR_HIST_count');

      test('main query is an overall rate', () => {
        const [{ expr }] = result.main.queries;
        const overallRate = `sum(rate(\${metric}${etc}) ${otelJoinQuery})`;
        expect(expr).toBe(overallRate);
      });

      test('preview query is an overall rate', () => {
        const [{ expr }] = result.preview.queries;
        const overallRate = `sum(rate(\${metric}${etc}) ${otelJoinQuery})`;
        expect(expr).toBe(overallRate);
      });

      test('breakdown query is an overall rate by group', () => {
        const [{ expr }] = result.breakdown.queries;
        const overallRateBreakdown = `sum(rate(\${metric}${etc}) ${otelJoinQuery})${byGroup}`;
        expect(expr).toBe(overallRateBreakdown);
      });

      test('there are no variants', () => {
        expect(result.variants.length).toBe(0);
      });
    });

    // ***WE DEFAULT TO HEATMAP HERE
    describe('metrics with _bucket suffix', () => {
      const result = getAutoQueriesForMetric('HIST_bucket');

      const percentileQueries = new Map<number, string>();
      percentileQueries.set(99, expandExpr('histogram_quantile(0.99, sum by(le) (rate(...[$__rate_interval])))'));
      percentileQueries.set(90, expandExpr('histogram_quantile(0.9, sum by(le) (rate(...[$__rate_interval])))'));
      percentileQueries.set(50, expandExpr('histogram_quantile(0.5, sum by(le) (rate(...[$__rate_interval])))'));

      test('there are 2 variants', () => {
        expect(result.variants.length).toBe(2);
      });

      const percentilesVariant = result.variants.find((variant) => variant.variant === 'percentiles');
      test('there is a percentiles variant', () => {
        expect(percentilesVariant).not.toBeNull();
      });

      const heatmap = result.variants.find((variant) => variant.variant === 'heatmap');
      test('there is a heatmap variant', () => {
        expect(heatmap).not.toBeNull();
      });

      [99, 90, 50].forEach((percentile) => {
        const percentileQuery = percentileQueries.get(percentile);
        test(`main panel has ${percentile}th percentile query`, () => {
          const found = result.main.queries.find((query) => query.expr === percentileQuery);
          expect(found).not.toBeNull();
        });
      });

      [99, 90, 50].forEach((percentile) => {
        const percentileQuery = percentileQueries.get(percentile);
        test(`percentiles variant panel has ${percentile}th percentile query`, () => {
          const found = percentilesVariant?.queries.find((query) => query.expr === percentileQuery);
          expect(found).not.toBeNull();
        });
      });

      test('preview panel has heatmap query', () => {
        const [{ expr }] = result.preview.queries;
        const expected = 'sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query})';
        expect(expr).toBe(expected);
      });

      const percentileGroupedQueries = new Map<number, string>();
      percentileGroupedQueries.set(
        99,
        expandExpr('histogram_quantile(0.99, sum by(le, ${groupby}) (rate(...[$__rate_interval])))')
      );
      percentileGroupedQueries.set(
        90,
        expandExpr('histogram_quantile(0.9, sum by(le, ${groupby}) (rate(...[$__rate_interval])))')
      );
      percentileGroupedQueries.set(
        50,
        expandExpr('histogram_quantile(0.5, sum by(le, ${groupby}) (rate(...[$__rate_interval])))')
      );

      [99, 90, 50].forEach((percentile) => {
        const percentileGroupedQuery = percentileGroupedQueries.get(percentile);
        test(`breakdown panel has ${percentile}th query with \${groupby} appended`, () => {
          const found = result.breakdown.queries.find((query) => query.expr === percentileGroupedQuery);
          expect(found).not.toBeNull();
        });
      });
    });
  });
  describe('Consider result.main query (only first)', () => {
    it.each([
      // no rate
      ['PREFIX_general', 'avg(... ${otel_join_query})', 'short', 1],
      ['PREFIX_bytes', 'avg(... ${otel_join_query})', 'bytes', 1],
      ['PREFIX_seconds', 'avg(... ${otel_join_query})', 's', 1],
      // rate with counts per second
      ['PREFIX_count', 'sum(rate(...[$__rate_interval]) ${otel_join_query})', 'cps', 1], // cps = counts per second
      ['PREFIX_total', 'sum(rate(...[$__rate_interval]) ${otel_join_query})', 'cps', 1],
      ['PREFIX_seconds_count', 'sum(rate(...[$__rate_interval]) ${otel_join_query})', 'cps', 1],
      // rate with seconds per second
      ['PREFIX_seconds_total', 'sum(rate(...[$__rate_interval]) ${otel_join_query})', 'short', 1], // s/s
      // rate with bytes per second
      ['PREFIX_bytes_total', 'sum(rate(...[$__rate_interval]) ${otel_join_query})', 'Bps', 1], // bytes/s
      // mean with non-rated units
      [
        'PREFIX_seconds_sum',
        'sum(rate(PREFIX_seconds_sum{${filters}}[$__rate_interval]) ${otel_join_query})/sum(rate(PREFIX_seconds_count{${filters}}[$__rate_interval]) ${otel_join_query})',
        's',
        1,
      ],
      [
        'PREFIX_bytes_sum',
        'sum(rate(PREFIX_bytes_sum{${filters}}[$__rate_interval]) ${otel_join_query})/sum(rate(PREFIX_bytes_count{${filters}}[$__rate_interval]) ${otel_join_query})',
        'bytes',
        1,
      ],
      // ***WE DEFAULT TO HEATMAP HERE
      // Bucket
      ['PREFIX_bucket', 'sum by(le) (rate(...[$__rate_interval]) ${otel_join_query})', 'short', 1],
      ['PREFIX_seconds_bucket', 'sum by(le) (rate(...[$__rate_interval]) ${otel_join_query})', 's', 1],
      ['PREFIX_bytes_bucket', 'sum by(le) (rate(...[$__rate_interval]) ${otel_join_query})', 'bytes', 1],
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
      ['PREFIX_general', 'avg(... ${otel_join_query})', 'short'],
      ['PREFIX_bytes', 'avg(... ${otel_join_query})', 'bytes'],
      ['PREFIX_seconds', 'avg(... ${otel_join_query})', 's'],
      // rate with counts per second
      ['PREFIX_count', 'sum(rate(...[$__rate_interval]) ${otel_join_query})', 'cps'], // cps = counts per second
      ['PREFIX_total', 'sum(rate(...[$__rate_interval]) ${otel_join_query})', 'cps'],
      ['PREFIX_seconds_count', 'sum(rate(...[$__rate_interval]) ${otel_join_query})', 'cps'],
      // rate with seconds per second
      ['PREFIX_seconds_total', 'sum(rate(...[$__rate_interval]) ${otel_join_query})', 'short'], // s/s
      // rate with bytes per second
      ['PREFIX_bytes_total', 'sum(rate(...[$__rate_interval]) ${otel_join_query})', 'Bps'], // bytes/s
      // mean with non-rated units
      [
        'PREFIX_seconds_sum',
        'sum(rate(PREFIX_seconds_sum{${filters}}[$__rate_interval]) ${otel_join_query})/sum(rate(PREFIX_seconds_count{${filters}}[$__rate_interval]) ${otel_join_query})',
        's',
      ],
      [
        'PREFIX_bytes_sum',
        'sum(rate(PREFIX_bytes_sum{${filters}}[$__rate_interval]) ${otel_join_query})/sum(rate(PREFIX_bytes_count{${filters}}[$__rate_interval]) ${otel_join_query})',
        'bytes',
      ],
      // Bucket
      ['PREFIX_bucket', 'sum by(le) (rate(...[$__rate_interval]) ${otel_join_query})', 'short'],
      ['PREFIX_seconds_bucket', 'sum by(le) (rate(...[$__rate_interval]) ${otel_join_query})', 's'],
      ['PREFIX_bytes_bucket', 'sum by(le) (rate(...[$__rate_interval]) ${otel_join_query})', 'bytes'],
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
      ['PREFIX_general', 'avg(... ${otel_join_query})by(${groupby})', 'short'],
      ['PREFIX_bytes', 'avg(... ${otel_join_query})by(${groupby})', 'bytes'],
      ['PREFIX_seconds', 'avg(... ${otel_join_query})by(${groupby})', 's'],
      // rate with counts per second
      ['PREFIX_count', 'sum(rate(...[$__rate_interval]) ${otel_join_query})by(${groupby})', 'cps'], // cps = counts per second
      ['PREFIX_total', 'sum(rate(...[$__rate_interval]) ${otel_join_query})by(${groupby})', 'cps'],
      ['PREFIX_seconds_count', 'sum(rate(...[$__rate_interval]) ${otel_join_query})by(${groupby})', 'cps'],
      // rate with seconds per second
      ['PREFIX_seconds_total', 'sum(rate(...[$__rate_interval]) ${otel_join_query})by(${groupby})', 'short'], // s/s
      // rate with bytes per second
      ['PREFIX_bytes_total', 'sum(rate(...[$__rate_interval]) ${otel_join_query})by(${groupby})', 'Bps'], // bytes/s
      // mean with non-rated units
      [
        'PREFIX_seconds_sum',
        'sum(rate(PREFIX_seconds_sum{${filters}}[$__rate_interval]) ${otel_join_query})by(${groupby})/sum(rate(PREFIX_seconds_count{${filters}}[$__rate_interval]) ${otel_join_query})by(${groupby})',
        's',
      ],
      [
        'PREFIX_bytes_sum',
        'sum(rate(PREFIX_bytes_sum{${filters}}[$__rate_interval]) ${otel_join_query})by(${groupby})/sum(rate(PREFIX_bytes_count{${filters}}[$__rate_interval]) ${otel_join_query})by(${groupby})',
        'bytes',
      ],
      // Bucket
      [
        'PREFIX_bucket',
        'histogram_quantile(0.5, sum by(le, ${groupby}) (rate(...[$__rate_interval]) ${otel_join_query}))',
        'short',
      ],
      [
        'PREFIX_seconds_bucket',
        'histogram_quantile(0.5, sum by(le, ${groupby}) (rate(...[$__rate_interval]) ${otel_join_query}))',
        's',
      ],
      [
        'PREFIX_bytes_bucket',
        'histogram_quantile(0.5, sum by(le, ${groupby}) (rate(...[$__rate_interval]) ${otel_join_query}))',
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
      ['PREFIX_count', []],
      ['PREFIX_seconds_count', []],
      ['PREFIX_bytes', []],
      ['PREFIX_seconds', []],
      ['PREFIX_general', []],
      ['PREFIX_seconds_total', []],
      ['PREFIX_seconds_sum', []],
      // Bucket variants
      [
        'PREFIX_bucket',
        [
          {
            variant: 'percentiles',
            unit: 'short',
            exprs: [
              'histogram_quantile(0.99, sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query}))',
              'histogram_quantile(0.9, sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query}))',
              'histogram_quantile(0.5, sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query}))',
            ],
          },
          {
            variant: 'heatmap',
            unit: 'short',
            exprs: ['sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query})'],
          },
        ],
      ],
      [
        'PREFIX_seconds_bucket',
        [
          {
            variant: 'percentiles',
            unit: 's',
            exprs: [
              'histogram_quantile(0.99, sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query}))',
              'histogram_quantile(0.9, sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query}))',
              'histogram_quantile(0.5, sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query}))',
            ],
          },
          {
            variant: 'heatmap',
            unit: 's',
            exprs: ['sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query})'],
          },
        ],
      ],
      [
        'PREFIX_bytes_bucket',
        [
          {
            variant: 'percentiles',
            unit: 'bytes',
            exprs: [
              'histogram_quantile(0.99, sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query}))',
              'histogram_quantile(0.9, sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query}))',
              'histogram_quantile(0.5, sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query}))',
            ],
          },
          {
            variant: 'heatmap',
            unit: 'bytes',
            exprs: ['sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query})'],
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
    it.each([['PRODUCT_High_Priority_items_', 'avg(... ${otel_join_query})', 'short', 1]])(
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

describe('generateBaseQuery', () => {
  it('should generate a non-rate non-UTF8 base query', () => {
    expect(generateBaseQuery({ isRateQuery: false, isUtf8Metric: false })).toBe(
      `${VAR_METRIC_EXPR}{${VAR_FILTERS_EXPR}} ${VAR_OTEL_JOIN_QUERY_EXPR}`
    );
  });

  it('should generate a rate non-UTF8 base query', () => {
    expect(generateBaseQuery({ isRateQuery: true, isUtf8Metric: false })).toBe(
      `rate(${VAR_METRIC_EXPR}{${VAR_FILTERS_EXPR}}[$__rate_interval]) ${VAR_OTEL_JOIN_QUERY_EXPR}`
    );
  });

  it('should generate a non-rate UTF8 base query', () => {
    expect(generateBaseQuery({ isRateQuery: false, isUtf8Metric: true })).toBe(
      `{"${VAR_METRIC_EXPR}", ${VAR_FILTERS_EXPR}} ${VAR_OTEL_JOIN_QUERY_EXPR}`
    );
  });

  it('should generate a rate UTF8 base query', () => {
    expect(generateBaseQuery({ isRateQuery: true, isUtf8Metric: true })).toBe(
      `rate({"${VAR_METRIC_EXPR}", ${VAR_FILTERS_EXPR}}[$__rate_interval]) ${VAR_OTEL_JOIN_QUERY_EXPR}`
    );
  });

  it('should generate a grouped non-UTF8 rate query', () => {
    expect(
      generateBaseQuery({
        isRateQuery: true,
        isUtf8Metric: false,
        groupings: ['le', 'job'],
      })
    ).toBe(
      `sum by(le, job) (rate(${VAR_METRIC_EXPR}{${VAR_FILTERS_EXPR}}[$__rate_interval]) ${VAR_OTEL_JOIN_QUERY_EXPR})`
    );
  });

  it('should generate a grouped UTF8 rate query', () => {
    expect(
      generateBaseQuery({
        isRateQuery: true,
        isUtf8Metric: true,
        groupings: ['le', 'instance'],
      })
    ).toBe(
      `sum by(le, instance) (rate({"${VAR_METRIC_EXPR}", ${VAR_FILTERS_EXPR}}[$__rate_interval]) ${VAR_OTEL_JOIN_QUERY_EXPR})`
    );
  });
});
