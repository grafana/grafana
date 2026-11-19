import { getBackendSrv } from '@grafana/runtime';

import {
  CPU_PROFILE_TYPE,
  lokiSeriesRange,
  promLabelValues,
  promRange,
  promSeries,
  pyroscopeLabelValues,
  pyroscopeSelectSeries,
  tempoMetricsRange,
  tempoTagValues,
} from './labApi';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

jest.mock('../dataSources', () => ({
  requireDataSource: jest.fn().mockResolvedValue('traces-uid'),
}));

const get = jest.fn();
const post = jest.fn();

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  jest.mocked(getBackendSrv).mockReturnValue({ get, post } as unknown as ReturnType<typeof getBackendSrv>);
});

describe('tempoTagValues', () => {
  it('asks the chosen traces data source for the values of the tag', async () => {
    get.mockResolvedValue({ tagValues: [{ type: 'string', value: 'checkout' }] });

    const values = await tempoTagValues('resource.service.name', 1000, 2000);

    expect(get).toHaveBeenCalledWith(
      '/api/datasources/proxy/uid/traces-uid/api/v2/search/tag/resource.service.name/values',
      { start: 1000, end: 2000 },
      undefined,
      { showErrorAlert: false }
    );
    expect(values).toEqual(['checkout']);
  });

  it('sends the filter as a TraceQL query so only the values seen on matching spans come back', async () => {
    get.mockResolvedValue({ tagValues: [{ type: 'string', value: 'checkout' }] });

    await tempoTagValues('resource.service.name', 1000, 2000, '{ resource.deployment.environment.name="prod" }');

    expect(get).toHaveBeenCalledWith(
      '/api/datasources/proxy/uid/traces-uid/api/v2/search/tag/resource.service.name/values',
      { start: 1000, end: 2000, q: '{ resource.deployment.environment.name="prod" }' },
      undefined,
      { showErrorAlert: false }
    );
  });

  // Tempo's JSON leaves the value out of an entry whose value is an empty string, and an empty name names nothing.
  it.each([
    { entry: 'has no value', tagValue: { type: 'string' } },
    { entry: 'has a null value', tagValue: { type: 'string', value: null } },
    { entry: 'has an empty value', tagValue: { type: 'string', value: '' } },
  ])('leaves out an entry that $entry', async ({ tagValue }) => {
    get.mockResolvedValue({
      tagValues: [{ type: 'string', value: 'checkout' }, tagValue, { type: 'string', value: 'cart' }],
    });

    expect(await tempoTagValues('resource.service.name', 0, 1)).toEqual(['checkout', 'cart']);
  });

  it('returns no values when Tempo sends no tag values', async () => {
    get.mockResolvedValue({});

    expect(await tempoTagValues('resource.service.name', 0, 1)).toEqual([]);
  });
});

describe('tempoMetricsRange', () => {
  it('asks the traces data source for the metrics query, with the step in seconds', async () => {
    get.mockResolvedValue({});

    await tempoMetricsRange('{ status = error } | count_over_time()', 1000, 2000, 60);

    expect(get).toHaveBeenCalledWith(
      '/api/datasources/proxy/uid/traces-uid/api/metrics/query_range',
      { q: '{ status = error } | count_over_time()', start: 1000, end: 2000, step: '60s' },
      undefined,
      { showErrorAlert: false }
    );
  });

  // Tempo's JSON sends an int64 as a string and leaves out a zero.
  it('reads the labels and the samples, and counts a sample with no value as 0', async () => {
    get.mockResolvedValue({
      series: [
        {
          labels: [{ key: 'status', value: { stringValue: 'error' } }],
          samples: [{ timestampMs: '60000', value: 3 }, { timestampMs: '120000' }],
        },
        { labels: [{ key: 'attempt', value: { intValue: '7' } }], samples: [{ timestampMs: '60000', value: 1 }] },
        { samples: [{ timestampMs: '60000', value: 2 }] },
      ],
    });

    expect(await tempoMetricsRange('q', 0, 1, 60)).toEqual([
      { metric: { status: 'error' }, times: [60, 120], values: [3, 0] },
      { metric: { attempt: '7' }, times: [60], values: [1] },
      { metric: {}, times: [60], values: [2] },
    ]);
  });

  it('returns no series when Tempo sends none', async () => {
    get.mockResolvedValue({});

    expect(await tempoMetricsRange('q', 0, 1, 60)).toEqual([]);
  });
});

describe('promRange', () => {
  it('turns each row into a series with its labels, times and numbers', async () => {
    get.mockResolvedValue({
      data: {
        result: [
          {
            metric: { service_name: 'checkout' },
            values: [
              [1, '2.5'],
              [2, 'NaN'],
            ],
          },
        ],
      },
    });

    expect(await promRange('up', 1, 2, 1)).toEqual([
      { metric: { service_name: 'checkout' }, times: [1, 2], values: [2.5, NaN] },
    ]);
  });
});

describe('promLabelValues', () => {
  it('asks the metrics data source for the values of the label, limited to the series a selector picks', async () => {
    get.mockResolvedValue({ data: ['traces_spanmetrics_calls_total'] });

    const values = await promLabelValues('__name__', 1000, 2000, '{__name__=~"traces_span_?metrics_calls_total"}');

    expect(get).toHaveBeenCalledWith(
      '/api/datasources/proxy/uid/traces-uid/api/v1/label/__name__/values',
      { start: 1000, end: 2000, 'match[]': '{__name__=~"traces_span_?metrics_calls_total"}' },
      undefined,
      { showErrorAlert: false }
    );
    expect(values).toEqual(['traces_spanmetrics_calls_total']);
  });

  it('sends no selector when none is given', async () => {
    get.mockResolvedValue({ data: [] });

    await promLabelValues('service', 1000, 2000);

    expect(get).toHaveBeenCalledWith(expect.any(String), { start: 1000, end: 2000 }, undefined, {
      showErrorAlert: false,
    });
  });
});

describe('promSeries', () => {
  it('asks for the label sets of at most limit series that the selector matches', async () => {
    get.mockResolvedValue({ data: [{ __name__: 'up', service: 'checkout' }] });

    const series = await promSeries('{service="checkout"}', 1000, 2000, 1);

    expect(get).toHaveBeenCalledWith(
      '/api/datasources/proxy/uid/traces-uid/api/v1/series',
      { 'match[]': '{service="checkout"}', start: 1000, end: 2000, limit: 1 },
      undefined,
      { showErrorAlert: false }
    );
    expect(series).toEqual([{ __name__: 'up', service: 'checkout' }]);
  });
});

describe('lokiSeriesRange', () => {
  it('asks the logs data source in nanoseconds and keeps every series with its labels', async () => {
    get.mockResolvedValue({
      data: {
        result: [
          {
            metric: { detected_level: 'error' },
            values: [
              [60, '2'],
              [120, '3'],
            ],
          },
          { metric: { detected_level: 'info' }, values: [[60, '10']] },
        ],
      },
    });

    const series = await lokiSeriesRange('sum by (detected_level) (count_over_time({a="b"}[60s]))', 60, 120, 60);

    expect(get).toHaveBeenCalledWith(
      '/api/datasources/proxy/uid/traces-uid/loki/api/v1/query_range',
      { query: 'sum by (detected_level) (count_over_time({a="b"}[60s]))', start: 60e9, end: 120e9, step: 60 },
      undefined,
      { showErrorAlert: false }
    );
    expect(series).toEqual([
      { metric: { detected_level: 'error' }, times: [60, 120], values: [2, 3] },
      { metric: { detected_level: 'info' }, times: [60], values: [10] },
    ]);
  });
});

describe('pyroscopeSelectSeries', () => {
  it('posts the query to the profiles data source in milliseconds', async () => {
    post.mockResolvedValue({
      series: [
        {
          labels: [{ name: 'service_name', value: 'checkout' }],
          points: [{ value: 1.5, timestamp: '60000' }, { timestamp: '120000' }],
        },
      ],
    });

    const series = await pyroscopeSelectSeries('{service_name="checkout"}', 60, 120, 60);

    expect(post).toHaveBeenCalledWith(
      '/api/datasources/proxy/uid/traces-uid/querier.v1.QuerierService/SelectSeries',
      {
        profileTypeID: CPU_PROFILE_TYPE,
        labelSelector: '{service_name="checkout"}',
        start: 60000,
        end: 120000,
        step: 60,
        groupBy: [],
      },
      { showErrorAlert: false }
    );
    expect(series).toEqual([{ metric: { service_name: 'checkout' }, times: [60, 120], values: [1.5, 0] }]);
  });

  it('returns no series when Pyroscope sends none', async () => {
    post.mockResolvedValue({});

    expect(await pyroscopeSelectSeries('{service_name="checkout"}', 0, 1, 60)).toEqual([]);
  });
});

describe('pyroscopeLabelValues', () => {
  it('posts the label name to the profiles data source in milliseconds and returns its values', async () => {
    post.mockResolvedValue({ names: ['checkout', 'shop/cart'] });

    const values = await pyroscopeLabelValues('service_name', 60, 120);

    expect(post).toHaveBeenCalledWith(
      '/api/datasources/proxy/uid/traces-uid/querier.v1.QuerierService/LabelValues',
      { name: 'service_name', start: 60000, end: 120000 },
      { showErrorAlert: false }
    );
    expect(values).toEqual(['checkout', 'shop/cart']);
  });

  it('returns no values when Pyroscope sends none', async () => {
    post.mockResolvedValue({});

    expect(await pyroscopeLabelValues('service_name', 0, 1)).toEqual([]);
  });
});
