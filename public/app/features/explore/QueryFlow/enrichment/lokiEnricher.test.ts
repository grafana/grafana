import {
  type DataFrame,
  type DataSourceApi,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
} from '@grafana/data';
import { LabelType } from 'app/plugins/datasource/loki/types';

import { QueryFlowNodeKind, type QueryFlowNode } from '../model/types';

import { classifyLabel, labelNameOf, lokiEnricher, lokiSummaryRows } from './lokiEnricher';
import { type EnrichmentContext } from './types';

function frame(fields: DataFrame['fields']): DataFrame {
  return { refId: 'A', length: 0, fields } as unknown as DataFrame;
}

function frameWithStats(stats: Array<{ displayName: string; value: number; unit?: string }>): DataFrame {
  return { refId: 'A', length: 0, fields: [], meta: { stats } } as unknown as DataFrame;
}

function labelFrame(labels: Array<Record<string, string>>, labelTypes: Array<Record<string, string>>): DataFrame {
  return {
    refId: 'A',
    length: labels.length,
    fields: [
      { name: 'labels', type: 'other', config: {}, values: labels },
      { name: 'labelTypes', type: 'other', config: {}, values: labelTypes },
    ],
  } as unknown as DataFrame;
}

function selectorNode(): QueryFlowNode {
  return {
    id: 'selector:0-11',
    kind: QueryFlowNodeKind.Selector,
    language: 'logql',
    label: '{job="app"}',
    span: { from: 0, to: 11 },
    childIds: [],
  };
}

function makeCtx(overrides: Partial<EnrichmentContext> = {}): EnrichmentContext {
  return {
    datasource: { type: 'loki' } as unknown as DataSourceApi,
    timeRange: getDefaultTimeRange(),
    expr: '{job="app"}',
    refId: 'A',
    isRoot: false,
    queryResponse: undefined,
    ...overrides,
  };
}

function doneResponse(series: DataFrame[], extra: Partial<PanelData> = {}): PanelData {
  return { state: LoadingState.Done, series, ...extra } as unknown as PanelData;
}

describe('lokiSummaryRows', () => {
  it('surfaces the summary stats (stripped of the "Summary:" prefix) plus curated cost stats (kept prefixed)', () => {
    const rows = lokiSummaryRows([
      frameWithStats([
        { displayName: 'Summary: total bytes processed', value: 2048, unit: 'decbytes' },
        { displayName: 'Summary: exec time', value: 0.123, unit: 's' },
        { displayName: 'Ingester: total reached', value: 3, unit: 'short' },
        { displayName: 'Store: head chunk bytes', value: 99, unit: 'decbytes' },
      ]),
    ]);
    expect(rows).toEqual([
      { label: 'total bytes processed', value: '2.05 kB' },
      { label: 'exec time', value: '123 ms' },
      { label: 'Ingester: total reached', value: '3' },
    ]);
  });

  it('returns nothing when no frame carries summary or curated cost stats', () => {
    expect(lokiSummaryRows([frameWithStats([{ displayName: 'Store: head chunk bytes', value: 3 }])])).toEqual([]);
    expect(lokiSummaryRows([])).toEqual([]);
  });
});

describe('labelNameOf', () => {
  it.each([
    ['level="error"', 'level'],
    ['status >= 500', 'status'],
    ['  detected_level != "info"', 'detected_level'],
    ['"quoted"', ''],
  ])('extracts the leading identifier from %p', (label, expected) => {
    expect(labelNameOf({ label } as QueryFlowNode)).toBe(expected);
  });
});

describe('classifyLabel', () => {
  const frames = [labelFrame([{ level: 'error', job: 'app' }], [{ level: 'P', job: 'I' }])];

  it('classifies a parsed label', () => {
    expect(classifyLabel(frames, 'level')).toBe(LabelType.Parsed);
  });
  it('classifies an indexed label', () => {
    expect(classifyLabel(frames, 'job')).toBe(LabelType.Indexed);
  });
  it('returns undefined for an unknown or empty label', () => {
    expect(classifyLabel(frames, 'missing')).toBeUndefined();
    expect(classifyLabel(frames, '')).toBeUndefined();
  });
});

describe('lokiEnricher.enrichNode', () => {
  it('annotates a selector with index stats', async () => {
    const getStats = jest.fn().mockResolvedValue({ streams: 5, chunks: 10, bytes: 1048576, entries: 1000 });
    const ctx = makeCtx({ datasource: { type: 'loki', getStats } as unknown as DataSourceApi });

    const enrichment = await lokiEnricher.enrichNode(selectorNode(), ctx);

    expect(getStats).toHaveBeenCalledWith({ refId: 'A', expr: '{job="app"}' }, ctx.timeRange);
    expect(enrichment?.badge).toMatch(/5 streams/);
    expect(enrichment?.rows).toEqual([
      { label: 'Streams', value: '5' },
      { label: 'Chunks', value: '10' },
      { label: 'Entries', value: '1 K' },
      { label: 'Size', value: '1.05 MB' },
    ]);
  });

  it('returns undefined for a non-root selector with no stats', async () => {
    const getStats = jest.fn().mockResolvedValue(null);
    const ctx = makeCtx({ datasource: { type: 'loki', getStats } as unknown as DataSourceApi });
    expect(await lokiEnricher.enrichNode(selectorNode(), ctx)).toBeUndefined();
  });

  it('annotates a parser with detected fields and flags parse errors', async () => {
    const fetchDetectedFields = jest.fn().mockResolvedValue({
      fields: [
        { label: 'trace_id', type: 'string', cardinality: 1200, parsers: ['json'] },
        { label: 'status', type: 'int', cardinality: 0, parsers: ['json'] },
      ],
      limit: 1000,
    });
    const ctx = makeCtx({
      expr: '{job="app"} | json',
      datasource: { type: 'loki', languageProvider: { fetchDetectedFields } } as unknown as DataSourceApi,
      queryResponse: doneResponse([
        frame([{ name: 'labels', type: FieldType.other, config: {}, values: [{ __error__: 'x' }] }]),
      ]),
    });
    const parser: QueryFlowNode = {
      id: 'parser:12-18',
      kind: QueryFlowNodeKind.Parser,
      language: 'logql',
      label: 'json',
      span: { from: 12, to: 18 },
      childIds: [],
    };

    const enrichment = await lokiEnricher.enrichNode(parser, ctx);

    expect(enrichment?.badge).toBe('2 fields');
    expect(enrichment?.rows).toContainEqual({ label: 'trace_id', value: 'string · 1.20 K' });
    expect(enrichment?.rows).toContainEqual({ label: 'status', value: 'int' });
    expect(enrichment?.severity).toBe('warning');
  });

  it('caches detected fields per (datasource, expr, range) so multiple parser nodes share one fetch', async () => {
    const fetchDetectedFields = jest.fn().mockResolvedValue({ fields: [], limit: 1000 });
    const datasource = { type: 'loki', languageProvider: { fetchDetectedFields } } as unknown as DataSourceApi;
    const ctx = makeCtx({ expr: '{job="app"} | json | logfmt', datasource });
    const jsonParser: QueryFlowNode = {
      id: 'parser:12-16',
      kind: QueryFlowNodeKind.Parser,
      language: 'logql',
      label: 'json',
      span: { from: 12, to: 16 },
      childIds: [],
    };
    const logfmtParser: QueryFlowNode = {
      id: 'parser:19-26',
      kind: QueryFlowNodeKind.Parser,
      language: 'logql',
      label: 'logfmt',
      span: { from: 19, to: 26 },
      childIds: [],
    };

    await lokiEnricher.enrichNode(jsonParser, ctx);
    await lokiEnricher.enrichNode(logfmtParser, ctx);

    expect(fetchDetectedFields).toHaveBeenCalledTimes(1);
  });

  it('reports state: error when the selector stats call fails', async () => {
    const getStats = jest.fn().mockRejectedValue(new Error('index down'));
    const ctx = makeCtx({ datasource: { type: 'loki', getStats } as unknown as DataSourceApi });

    const enrichment = await lokiEnricher.enrichNode(selectorNode(), ctx);

    expect(enrichment).toEqual({ state: 'error' });
  });

  it('reports state: error when the detected-fields call fails', async () => {
    const fetchDetectedFields = jest.fn().mockRejectedValue(new Error('backend down'));
    const ctx = makeCtx({
      expr: '{job="app"} | json',
      datasource: { type: 'loki', languageProvider: { fetchDetectedFields } } as unknown as DataSourceApi,
    });
    const parser: QueryFlowNode = {
      id: 'parser:12-16',
      kind: QueryFlowNodeKind.Parser,
      language: 'logql',
      label: 'json',
      span: { from: 12, to: 16 },
      childIds: [],
    };

    const enrichment = await lokiEnricher.enrichNode(parser, ctx);

    expect(enrichment).toEqual({ state: 'error' });
  });

  it('annotates the root with result count and query cost', async () => {
    const ctx = makeCtx({
      isRoot: true,
      queryResponse: doneResponse([
        frameWithStats([{ displayName: 'Summary: total bytes processed', value: 2048, unit: 'decbytes' }]),
        frameWithStats([{ displayName: 'Summary: total bytes processed', value: 2048, unit: 'decbytes' }]),
      ]),
    });
    const root: QueryFlowNode = {
      id: 'function:0-30',
      kind: QueryFlowNodeKind.Function,
      language: 'logql',
      label: 'rate',
      span: { from: 0, to: 30 },
      childIds: [],
    };

    const enrichment = await lokiEnricher.enrichNode(root, ctx);

    expect(enrichment?.rows).toContainEqual({ label: 'total bytes processed', value: '2.05 kB' });
    expect(enrichment?.rows).toContainEqual({ label: 'Result', value: '2 series' });
    expect(enrichment?.badge).toBe('2 series');
  });

  it('surfaces query hints on the root from the already-run result frames', async () => {
    const getQueryHints = jest
      .fn()
      .mockReturnValue([{ type: 'ADD_JSON_PARSER', label: 'Consider using JSON parser.' }]);
    const ctx = makeCtx({
      isRoot: true,
      datasource: { type: 'loki', getQueryHints } as unknown as DataSourceApi,
      queryResponse: doneResponse([frame([])]),
    });
    const root: QueryFlowNode = {
      id: 'selector:0-11',
      kind: QueryFlowNodeKind.Selector,
      language: 'logql',
      label: '{job="app"}',
      span: { from: 0, to: 11 },
      childIds: [],
    };

    const enrichment = await lokiEnricher.enrichNode(root, ctx);

    expect(getQueryHints).toHaveBeenCalledWith({ refId: 'A', expr: '{job="app"}' }, [frame([])]);
    expect(enrichment?.rows).toContainEqual({ label: 'Hint', value: 'Consider using JSON parser.' });
  });

  it('surfaces the response error and trace id on the root', async () => {
    const ctx = makeCtx({
      isRoot: true,
      queryResponse: {
        state: LoadingState.Error,
        series: [],
        errors: [{ refId: 'A', message: 'backend unavailable', traceId: 'trace-789' }],
      } as unknown as PanelData,
    });
    const root: QueryFlowNode = {
      id: 'selector:0-11',
      kind: QueryFlowNodeKind.Selector,
      language: 'logql',
      label: '{job="app"}',
      span: { from: 0, to: 11 },
      childIds: [],
    };

    const enrichment = await lokiEnricher.enrichNode(root, ctx);

    expect(enrichment?.severity).toBe('error');
    expect(enrichment?.rows).toContainEqual({ label: 'Error', value: 'backend unavailable' });
    expect(enrichment?.rows).toContainEqual({ label: 'Trace ID', value: 'trace-789' });
  });

  it('shows the effective duration for a range that uses a Grafana interval placeholder', async () => {
    const expr = 'count_over_time({job="app"}[$__auto])';
    const rangeText = '[$__auto]';
    const from = expr.indexOf(rangeText);
    const ctx = makeCtx({
      expr,
      queryResponse: doneResponse([], { request: { interval: '30s' } } as unknown as Partial<PanelData>),
    });
    const range: QueryFlowNode = {
      id: `range:${from}-${from + rangeText.length}`,
      kind: QueryFlowNodeKind.Range,
      language: 'logql',
      label: rangeText,
      span: { from, to: from + rangeText.length },
      childIds: [],
    };

    const enrichment = await lokiEnricher.enrichNode(range, ctx);

    expect(enrichment?.rows).toContainEqual({ label: 'Effective range', value: '[30s]' });
    expect(enrichment?.badge).toBe('[30s]');
  });

  it('does not annotate a range with a literal duration', async () => {
    const expr = 'count_over_time({job="app"}[5m])';
    const rangeText = '[5m]';
    const from = expr.indexOf(rangeText);
    const ctx = makeCtx({ expr });
    const range: QueryFlowNode = {
      id: `range:${from}-${from + rangeText.length}`,
      kind: QueryFlowNodeKind.Range,
      language: 'logql',
      label: rangeText,
      span: { from, to: from + rangeText.length },
      childIds: [],
    };

    expect(await lokiEnricher.enrichNode(range, ctx)).toBeUndefined();
  });
});
