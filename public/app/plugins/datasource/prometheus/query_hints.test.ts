import { getQueryHints, SUM_HINT_THRESHOLD_COUNT } from './query_hints';
import { PrometheusDatasource } from './datasource';
import { PromOptions, PromQuery } from './types';
import { DataSourceInstanceSettings, dateTime, TimeRange } from '../../../../../packages/grafana-data/src';

describe('getQueryHints()', () => {
  it('returns no hints for no series', () => {
    const promQuery: PromQuery = { refId: 'bar', expr: '' };
    expect(getQueryHints(promQuery, [])).toEqual([]);
  });

  it('returns no hints for empty series', () => {
    const promQuery: PromQuery = { refId: 'bar', expr: '' };
    expect(getQueryHints(promQuery, [{ datapoints: [] }])).toEqual([]);
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
    const hints = getQueryHints(promQuery, series);

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

    let hints = getQueryHints(promQuery, series, datasource);
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
    hints = getQueryHints(promQuery, series, datasource);
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
    const hints = getQueryHints(promQuery, series);
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
    const hints = getQueryHints(promQuery, series);
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
    const hints = getQueryHints(promQuery, series);
    expect(hints!.length).toBe(1);
    expect(hints![0].label).toContain('rate()');
    expect(hints![0].fix).toBeUndefined();
  });

  it('returns a histogram hint for a bucket series', () => {
    const promQuery = { refId: 'bar', expr: 'metric_bucket' };
    const series = [{ datapoints: [[23, 1000]] }];
    const hints = getQueryHints(promQuery, series);
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
    const hints = getQueryHints(promQuery, series);
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

  it('returns an interval hint when the interval is below the safe interval', () => {
    const instanceSettings = ({
      url: 'proxied',
      directUrl: 'direct',
      user: 'test',
      password: 'mupp',
      jsonData: {
        customQueryParameters: '',
      } as any,
    } as unknown) as DataSourceInstanceSettings<PromOptions>;
    const templateSrvStub = {
      getAdhocFilters: jest.fn(() => [] as any[]),
      replace: jest.fn((a: string, ...rest: any) => a),
    };
    const timeSrvStub = {
      timeRange(): any {
        return {
          from: dateTime(1531468681),
          to: dateTime(1531489712),
        };
      },
    };
    const datasource = new PrometheusDatasource(instanceSettings, templateSrvStub as any, timeSrvStub as any);
    const from = dateTime('2019-12-17T07:48:27.433Z');
    const to = dateTime('2019-12-17T13:48:27.433Z');
    const timeRange: TimeRange = {
      to,
      from,
      raw: { to, from },
    };
    datasource.getRange(timeRange);
    const promQuery = { refId: 'bar', expr: 'go_goroutines{}', interval: '1s' };
    const series = [
      {
        datapoints: [
          [23, 1000],
          [24, 1001],
        ],
      },
    ];
    const hints = getQueryHints(promQuery, series, datasource, timeRange);
    expect(hints!.length).toBe(1);
    expect(hints![0]).toMatchObject({
      type: 'SAFE_INTERVAL',
      label:
        'The specified step interval is lower than the safe interval and has been changed to 2s. Consider increasing the step interval or changing the time range',
    });
  });
});
