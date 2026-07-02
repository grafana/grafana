import { type DataFrame, type DataSourceApi, getDefaultTimeRange, LoadingState, type PanelData } from '@grafana/data';
import { PromApplication } from '@grafana/prometheus';

import { QueryFlowNodeKind, type QueryFlowNode } from '../model/types';

import { promEnricher } from './promEnricher';
import { type EnrichmentContext } from './types';

const EXPR = 'http_requests_total{job="x"}';

function selectorNode(): QueryFlowNode {
  return {
    id: 'selector:0-28',
    kind: QueryFlowNodeKind.Selector,
    language: 'promql',
    label: 'http_requests_total',
    span: { from: 0, to: EXPR.length },
    childIds: [],
  };
}

/** metadataRequest resolves a FetchResponse whose `.data` is the Prometheus `{ status, data }` envelope. */
function fetchResponse(payload: unknown) {
  return { data: { status: 'success', data: payload } };
}

function makeCtx(
  overrides: Partial<EnrichmentContext> = {},
  dsOverrides: Record<string, unknown> = {}
): EnrichmentContext {
  const datasource = {
    type: 'prometheus',
    languageProvider: { queryMetricsMetadata: jest.fn().mockResolvedValue({}) },
    metadataRequest: jest.fn().mockResolvedValue(fetchResponse({ seriesCountByMetricName: [] })),
    getQueryHints: jest.fn().mockReturnValue([]),
    ...dsOverrides,
  } as unknown as DataSourceApi;

  return {
    datasource,
    timeRange: getDefaultTimeRange(),
    expr: EXPR,
    refId: 'A',
    isRoot: false,
    queryResponse: undefined,
    ...overrides,
  };
}

function doneResponse(series: DataFrame[]): PanelData {
  return { state: LoadingState.Done, series } as unknown as PanelData;
}

describe('promEnricher.enrichNode', () => {
  it('annotates a selector with metric type and help', async () => {
    const ctx = makeCtx(
      {},
      {
        languageProvider: {
          queryMetricsMetadata: jest
            .fn()
            .mockResolvedValue({ http_requests_total: { type: 'counter', help: 'Total requests' } }),
        },
      }
    );

    const enrichment = await promEnricher.enrichNode(selectorNode(), ctx);

    expect(enrichment?.badge).toBe('counter');
    expect(enrichment?.rows).toContainEqual({ label: 'Type', value: 'counter' });
    expect(enrichment?.note).toBe('Total requests');
  });

  it('flags a high-cardinality metric from the tsdb snapshot', async () => {
    const ctx = makeCtx(
      {},
      {
        metadataRequest: jest
          .fn()
          .mockResolvedValue(
            fetchResponse({ seriesCountByMetricName: [{ name: 'http_requests_total', value: 9000 }] })
          ),
      }
    );

    const enrichment = await promEnricher.enrichNode(selectorNode(), ctx);

    expect(enrichment?.severity).toBe('warning');
    expect(enrichment?.badge).toBe('High cardinality');
    expect(enrichment?.rows).toContainEqual({ label: 'Cardinality', value: 'High (top metric)' });
  });

  it('fetches an exact series count only for Mimir', async () => {
    const metadataRequest = jest.fn((url: string) =>
      url.includes('cardinality')
        ? Promise.resolve(fetchResponse({ series_count_total: 1234 }))
        : Promise.resolve(fetchResponse({ seriesCountByMetricName: [] }))
    );
    const ctx = makeCtx({}, { metadataRequest, datasourceConfigurationPrometheusFlavor: PromApplication.Mimir });

    const enrichment = await promEnricher.enrichNode(selectorNode(), ctx);

    expect(metadataRequest).toHaveBeenCalledWith(
      '/api/v1/cardinality/label_values',
      { selector: EXPR, 'label_names[]': '__name__', limit: 1 },
      expect.anything()
    );
    expect(enrichment?.rows).toContainEqual({ label: 'Series', value: '1.23 K' });
  });

  it('caches the Mimir series count per selector so repeated hovers do not re-fetch', async () => {
    const metadataRequest = jest.fn((url: string) =>
      url.includes('cardinality')
        ? Promise.resolve(fetchResponse({ series_count_total: 1234 }))
        : Promise.resolve(fetchResponse({ seriesCountByMetricName: [] }))
    );
    const ctx = makeCtx({}, { metadataRequest, datasourceConfigurationPrometheusFlavor: PromApplication.Mimir });

    await promEnricher.enrichNode(selectorNode(), ctx);
    await promEnricher.enrichNode(selectorNode(), ctx);

    const cardinalityCalls = metadataRequest.mock.calls.filter(([url]) => url.includes('cardinality'));
    expect(cardinalityCalls).toHaveLength(1);
  });

  it('does not fetch a series count for vanilla Prometheus', async () => {
    const metadataRequest = jest.fn().mockResolvedValue(fetchResponse({ seriesCountByMetricName: [] }));
    const ctx = makeCtx({}, { metadataRequest });

    await promEnricher.enrichNode(selectorNode(), ctx);

    expect(metadataRequest).not.toHaveBeenCalledWith(
      '/api/v1/cardinality/label_values',
      expect.anything(),
      expect.anything()
    );
  });

  it('annotates the root with result count and all query hints', async () => {
    const ctx = makeCtx(
      {
        isRoot: true,
        queryResponse: doneResponse([{ refId: 'A' } as DataFrame, { refId: 'A' } as DataFrame]),
      },
      {
        getQueryHints: jest.fn().mockReturnValue([
          { type: 'ADD_RATE', label: 'Add rate()' },
          { type: 'EXPAND_RULES', label: 'Query contains recording rules.' },
        ]),
      }
    );
    const root: QueryFlowNode = {
      id: 'function:0-40',
      kind: QueryFlowNodeKind.Function,
      language: 'promql',
      label: 'rate',
      span: { from: 0, to: 40 },
      childIds: [],
    };

    const enrichment = await promEnricher.enrichNode(root, ctx);

    expect(enrichment?.rows).toContainEqual({ label: 'Hint', value: 'Add rate()' });
    expect(enrichment?.rows).toContainEqual({ label: 'Hint', value: 'Query contains recording rules.' });
    expect(enrichment?.rows).toContainEqual({ label: 'Result', value: '2 series' });
    expect(enrichment?.badge).toBe('2 series');
  });

  it('reports state: error when metadata and cardinality both fail and nothing else was found', async () => {
    const metadataRequest = jest.fn().mockRejectedValue(new Error('network down'));
    const ctx = makeCtx(
      {},
      {
        metadataRequest,
        languageProvider: { queryMetricsMetadata: jest.fn().mockRejectedValue(new Error('network down')) },
        datasourceConfigurationPrometheusFlavor: PromApplication.Mimir,
      }
    );

    const enrichment = await promEnricher.enrichNode(selectorNode(), ctx);

    expect(enrichment).toEqual({ state: 'error' });
  });

  it('still returns done with partial data when only one call fails', async () => {
    const metadataRequest = jest.fn((url: string) =>
      url.includes('cardinality')
        ? Promise.reject(new Error('cardinality down'))
        : Promise.resolve(fetchResponse({ seriesCountByMetricName: [] }))
    );
    const ctx = makeCtx(
      {},
      {
        metadataRequest,
        languageProvider: {
          queryMetricsMetadata: jest.fn().mockResolvedValue({ http_requests_total: { type: 'counter' } }),
        },
        datasourceConfigurationPrometheusFlavor: PromApplication.Mimir,
      }
    );

    const enrichment = await promEnricher.enrichNode(selectorNode(), ctx);

    expect(enrichment?.state).toBe('done');
    expect(enrichment?.badge).toBe('counter');
  });

  it('does not surface an error when the optional tsdb snapshot fails (soft-fail)', async () => {
    const metadataRequest = jest.fn().mockRejectedValue(new Error('tsdb unavailable'));
    const ctx = makeCtx(
      {},
      {
        metadataRequest,
        languageProvider: {
          queryMetricsMetadata: jest.fn().mockResolvedValue({ http_requests_total: { type: 'counter' } }),
        },
      }
    );

    const enrichment = await promEnricher.enrichNode(selectorNode(), ctx);

    expect(enrichment?.state).toBe('done');
    expect(enrichment?.badge).toBe('counter');
  });

  it('reads query cost from response stats (frame.meta.custom.stats) when present', async () => {
    const statsFrame = {
      refId: 'A',
      meta: {
        custom: {
          stats: { samples: { totalQueryableSamples: 1500, peakSamples: 300 }, timings: { evalTotalTime: 0.045 } },
        },
      },
    } as unknown as DataFrame;
    const ctx = makeCtx({ isRoot: true, queryResponse: doneResponse([statsFrame]) });
    const root: QueryFlowNode = {
      id: 'function:0-40',
      kind: QueryFlowNodeKind.Function,
      language: 'promql',
      label: 'rate',
      span: { from: 0, to: 40 },
      childIds: [],
    };

    const enrichment = await promEnricher.enrichNode(root, ctx);

    expect(enrichment?.rows).toContainEqual({ label: 'Samples processed', value: '1.50 K' });
    expect(enrichment?.rows).toContainEqual({ label: 'Peak samples', value: '300' });
    expect(enrichment?.rows).toContainEqual({ label: 'Eval time', value: '45 ms' });
  });

  it('surfaces the metric unit alongside its type', async () => {
    const ctx = makeCtx(
      {},
      {
        languageProvider: {
          queryMetricsMetadata: jest
            .fn()
            .mockResolvedValue({ http_requests_total: { type: 'counter', help: '', unit: 'reqps' } }),
        },
      }
    );

    const enrichment = await promEnricher.enrichNode(selectorNode(), ctx);

    expect(enrichment?.rows).toContainEqual({ label: 'Unit', value: 'reqps' });
  });

  it('flags a classic histogram bucket metric using the cached histogram-metric list', async () => {
    const bucketNode: QueryFlowNode = { ...selectorNode(), label: 'http_request_duration_seconds_bucket' };
    const ctx = makeCtx(
      {},
      {
        languageProvider: {
          queryMetricsMetadata: jest.fn().mockResolvedValue({}),
          retrieveHistogramMetrics: jest.fn().mockReturnValue(['http_request_duration_seconds_bucket']),
        },
      }
    );

    const enrichment = await promEnricher.enrichNode(bucketNode, ctx);

    expect(enrichment?.rows).toContainEqual({ label: 'Histogram', value: 'Classic (bucket metric)' });
  });

  it('does not double-flag a native histogram as a classic bucket', async () => {
    const ctx = makeCtx(
      {},
      {
        languageProvider: {
          queryMetricsMetadata: jest.fn().mockResolvedValue({ http_requests_total: { type: 'histogram', help: '' } }),
        },
      }
    );

    const enrichment = await promEnricher.enrichNode(selectorNode(), ctx);

    expect(enrichment?.rows).not.toContainEqual(expect.objectContaining({ label: 'Histogram' }));
  });

  it('badges a selector that is a recording rule and shows its underlying query', async () => {
    const ctx = makeCtx({}, { ruleMappings: { http_requests_total: [{ query: 'sum(rate(requests_total[5m]))' }] } });

    const enrichment = await promEnricher.enrichNode(selectorNode(), ctx);

    expect(enrichment?.badge).toBe('Recording rule');
    expect(enrichment?.rows).toContainEqual({
      label: 'Recording rule for',
      value: 'sum(rate(requests_total[5m]))',
    });
  });

  it('flags an ambiguous recording rule with multiple definitions', async () => {
    const ctx = makeCtx(
      {},
      {
        ruleMappings: {
          http_requests_total: [{ query: 'sum(rate(a[5m]))' }, { query: 'sum(rate(b[5m]))' }],
        },
      }
    );

    const enrichment = await promEnricher.enrichNode(selectorNode(), ctx);

    expect(enrichment?.rows).toContainEqual({ label: 'Definitions', value: '2' });
  });

  it('surfaces the result type from the response on the root', async () => {
    const frame = { refId: 'A', meta: { custom: { resultType: 'vector' } } } as unknown as DataFrame;
    const ctx = makeCtx({ isRoot: true, queryResponse: doneResponse([frame]) });
    const root: QueryFlowNode = {
      id: 'function:0-40',
      kind: QueryFlowNodeKind.Function,
      language: 'promql',
      label: 'rate',
      span: { from: 0, to: 40 },
      childIds: [],
    };

    const enrichment = await promEnricher.enrichNode(root, ctx);

    expect(enrichment?.rows).toContainEqual({ label: 'Result type', value: 'vector' });
  });

  it('reports exemplar availability on the root when supported', async () => {
    const ctx = makeCtx({ isRoot: true }, { exemplarsAvailable: true });
    const root: QueryFlowNode = {
      id: 'function:0-40',
      kind: QueryFlowNodeKind.Function,
      language: 'promql',
      label: 'rate',
      span: { from: 0, to: 40 },
      childIds: [],
    };

    const enrichment = await promEnricher.enrichNode(root, ctx);

    expect(enrichment?.rows).toContainEqual({ label: 'Exemplars', value: 'Available' });
  });

  it('surfaces the response error and trace id on the root', async () => {
    const ctx = makeCtx({
      isRoot: true,
      queryResponse: {
        state: LoadingState.Error,
        series: [],
        errors: [{ refId: 'A', message: 'upstream timeout', traceId: 'trace-789' }],
      } as unknown as PanelData,
    });
    const root: QueryFlowNode = {
      id: 'function:0-40',
      kind: QueryFlowNodeKind.Function,
      language: 'promql',
      label: 'rate',
      span: { from: 0, to: 40 },
      childIds: [],
    };

    const enrichment = await promEnricher.enrichNode(root, ctx);

    expect(enrichment?.severity).toBe('error');
    expect(enrichment?.rows).toContainEqual({ label: 'Error', value: 'upstream timeout' });
    expect(enrichment?.rows).toContainEqual({ label: 'Trace ID', value: 'trace-789' });
  });

  it('shows the effective step for a range that uses a Grafana interval placeholder, alongside the scrape interval', async () => {
    const expr = 'rate(http_requests_total[$__rate_interval])';
    const rangeText = '[$__rate_interval]';
    const from = expr.indexOf(rangeText);
    const ctx = makeCtx(
      {
        expr,
        queryResponse: { state: LoadingState.Done, series: [], request: { interval: '30s' } } as unknown as PanelData,
      },
      { interval: '15s' }
    );
    const range: QueryFlowNode = {
      id: `range:${from}-${from + rangeText.length}`,
      kind: QueryFlowNodeKind.Range,
      language: 'promql',
      label: rangeText,
      span: { from, to: from + rangeText.length },
      childIds: [],
    };

    const enrichment = await promEnricher.enrichNode(range, ctx);

    expect(enrichment?.rows).toContainEqual({ label: 'Effective step', value: '30s' });
    expect(enrichment?.rows).toContainEqual({ label: 'Scrape interval', value: '15s' });
    expect(enrichment?.badge).toBe('30s');
  });

  it('does not annotate a range with a literal duration', async () => {
    const expr = 'rate(http_requests_total[5m])';
    const rangeText = '[5m]';
    const from = expr.indexOf(rangeText);
    const ctx = makeCtx({ expr });
    const range: QueryFlowNode = {
      id: `range:${from}-${from + rangeText.length}`,
      kind: QueryFlowNodeKind.Range,
      language: 'promql',
      label: rangeText,
      span: { from, to: from + rangeText.length },
      childIds: [],
    };

    expect(await promEnricher.enrichNode(range, ctx)).toBeUndefined();
  });
});
