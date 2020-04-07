import { getQueryHints, SUM_HINT_THRESHOLD_COUNT } from './query_hints';
import { PrometheusDatasource } from './datasource';

describe('getQueryHints()', () => {
  it('returns no hints for no series', () => {
    expect(getQueryHints('', [])).toEqual(null);
  });

  it('returns no hints for empty series', () => {
    expect(getQueryHints('', [{ datapoints: [] }])).toEqual(null);
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

    let hints = getQueryHints('foo', series, datasource);
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

    // Test substring match not triggering hint
    hints = getQueryHints('foo_foo', series, datasource);
    expect(hints).toBe(null);
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
    expect(hints).toEqual(null);
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
    expect(hints).toEqual(null);
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
    const series = Array.from({ length: seriesCount }, _ => ({
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
