import { getQueryHints, SUM_HINT_THRESHOLD_COUNT } from './query_hints';
import { PrometheusDatasource } from './datasource';
import { PromQuery } from './types';

describe('getQueryHints()', () => {
  it('returns no hints for no series', () => {
    const promQuery: PromQuery = { refId: 'bar', expr: '' };
    expect(getQueryHints(promQuery.expr, [])).toEqual([]);
  });

  it('returns no hints for empty series', () => {
    const promQuery: PromQuery = { refId: 'bar', expr: '' };
    expect(getQueryHints(promQuery.expr, [{ datapoints: [] }])).toEqual([]);
  });

  it('returns a rate hint for a counter metric', () => {
    const series = [
      {
        datapoints: [
          [23, 1000],
          [24, 1001],
        ],
      },
    ];
    const promQuery = { refId: 'bar', expr: 'metric_total' };
    const hints = getQueryHints(promQuery.expr, series);

    expect(hints!.length).toBe(1);
    expect(hints![0]).toMatchObject({
      label: 'Metric metric_total looks like a counter.',
      fix: {
        action: {
          type: 'ADD_RATE',
          query: 'metric_total',
        },
      },
    });
  });

  it('returns a certain rate hint for a counter metric', () => {
    const series = [
      {
        datapoints: [
          [23, 1000],
          [24, 1001],
        ],
      },
    ];
    const mock: unknown = { languageProvider: { metricsMetadata: { foo: [{ type: 'counter' }] } } };
    const datasource = mock as PrometheusDatasource;
    let promQuery = { refId: 'bar', expr: 'foo' };

    let hints = getQueryHints(promQuery.expr, series, datasource);
    expect(hints!.length).toBe(1);
    expect(hints![0]).toMatchObject({
      label: 'Metric foo is a counter.',
      fix: {
        action: {
          type: 'ADD_RATE',
          query: 'foo',
        },
      },
    });

    promQuery = { ...promQuery, expr: 'foo_foo' };
    // Test substring match not triggering hint
    hints = getQueryHints(promQuery.expr, series, datasource);
    expect(hints).toEqual([]);
  });

  it('returns no rate hint for a counter metric that already has a rate', () => {
    const series = [
      {
        datapoints: [
          [23, 1000],
          [24, 1001],
        ],
      },
    ];
    const promQuery = { refId: 'bar', expr: 'rate(metric_total[1m])' };
    const hints = getQueryHints(promQuery.expr, series);
    expect(hints).toEqual([]);
  });

  it('returns no rate hint for a counter metric that already has an increase', () => {
    const series = [
      {
        datapoints: [
          [23, 1000],
          [24, 1001],
        ],
      },
    ];
    const promQuery = { refId: 'bar', expr: 'increase(metric_total[1m])' };
    const hints = getQueryHints(promQuery.expr, series);
    expect(hints).toEqual([]);
  });

  it('returns a rate hint w/o action for a complex counter metric', () => {
    const series = [
      {
        datapoints: [
          [23, 1000],
          [24, 1001],
        ],
      },
    ];
    const promQuery = { refId: 'bar', expr: 'sum(metric_total)' };
    const hints = getQueryHints(promQuery.expr, series);
    expect(hints!.length).toBe(1);
    expect(hints![0].label).toContain('rate()');
    expect(hints![0].fix).toBeUndefined();
  });

  it('returns a histogram hint for a bucket series', () => {
    const promQuery = { refId: 'bar', expr: 'metric_bucket' };
    const series = [{ datapoints: [[23, 1000]] }];
    const hints = getQueryHints(promQuery.expr, series);
    expect(hints!.length).toBe(1);
    expect(hints![0]).toMatchObject({
      label: 'Time series has buckets, you probably wanted a histogram.',
      fix: {
        action: {
          type: 'ADD_HISTOGRAM_QUANTILE',
          query: 'metric_bucket',
        },
      },
    });
  });

  it('returns a sum hint when many time series results are returned for a simple metric', () => {
    const seriesCount = SUM_HINT_THRESHOLD_COUNT;
    const series = Array.from({ length: seriesCount }, (_) => ({
      datapoints: [
        [0, 0],
        [0, 0],
      ],
    }));
    const promQuery = { refId: 'bar', expr: 'metric' };
    const hints = getQueryHints(promQuery.expr, series);
    expect(hints!.length).toBe(1);
    expect(hints![0]).toMatchObject({
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
