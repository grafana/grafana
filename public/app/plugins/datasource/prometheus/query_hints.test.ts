import { PrometheusDatasource } from './datasource';
import { getQueryHints, SUM_HINT_THRESHOLD_COUNT } from './query_hints';

describe('getQueryHints()', () => {
  it('returns no hints for no series', () => {
    expect(getQueryHints('', [])).toEqual([]);
  });

  it('returns no hints for empty series', () => {
    expect(getQueryHints('', [{ datapoints: [] }])).toEqual([]);
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
    const hints = getQueryHints('metric_total', series);

    expect(hints!.length).toBe(1);
    expect(hints![0]).toMatchObject({
      label: 'Selected metric looks like a counter.',
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
    const mock: unknown = { languageProvider: { metricsMetadata: { foo: { type: 'counter' } } } };
    const datasource = mock as PrometheusDatasource;

    let hints = getQueryHints('foo', series, datasource);
    expect(hints!.length).toBe(1);
    expect(hints![0]).toMatchObject({
      label: 'Selected metric is a counter.',
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

  it('returns no rate hint for a counter metric that already has a rate', () => {
    const series = [
      {
        datapoints: [
          [23, 1000],
          [24, 1001],
        ],
      },
    ];
    const hints = getQueryHints('rate(metric_total[1m])', series);
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
    const hints = getQueryHints('increase(metric_total[1m])', series);
    expect(hints).toEqual([]);
  });

  it('returns a rate hint with action for a counter metric with labels', () => {
    const series = [
      {
        datapoints: [
          [23, 1000],
          [24, 1001],
        ],
      },
    ];
    const hints = getQueryHints('metric_total{job="grafana"}', series);
    expect(hints!.length).toBe(1);
    expect(hints![0].label).toContain('Selected metric looks like a counter');
    expect(hints![0].fix).toBeDefined();
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
    const hints = getQueryHints('sum(metric_total)', series);
    expect(hints!.length).toBe(1);
    expect(hints![0].label).toContain('rate()');
    expect(hints![0].fix).toBeUndefined();
  });

  it('returns a histogram hint for a bucket series', () => {
    const series = [{ datapoints: [[23, 1000]] }];
    const hints = getQueryHints('metric_bucket', series);
    expect(hints!.length).toBe(1);
    expect(hints![0]).toMatchObject({
      label: 'Selected metric has buckets.',
      fix: {
        action: {
          type: 'ADD_HISTOGRAM_QUANTILE',
          query: 'metric_bucket',
        },
      },
    });
  });

  it('returns a histogram hint with action for a bucket with labels', () => {
    const series = [
      {
        datapoints: [
          [23, 1000],
          [24, 1001],
        ],
      },
    ];
    const hints = getQueryHints('metric_bucket{job="grafana"}', series);
    expect(hints!.length).toBe(1);
    expect(hints![0].label).toContain('Selected metric has buckets.');
    expect(hints![0].fix).toBeDefined();
  });

  it('returns a sum hint when many time series results are returned for a simple metric', () => {
    const seriesCount = SUM_HINT_THRESHOLD_COUNT;
    const series = Array.from({ length: seriesCount }, (_) => ({
      datapoints: [
        [0, 0],
        [0, 0],
      ],
    }));
    const hints = getQueryHints('metric', series);
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
