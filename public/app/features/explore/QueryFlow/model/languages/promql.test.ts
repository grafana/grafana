import { type QueryFlowGraph, type QueryFlowNode, QueryFlowNodeKind } from '../types';

import { promqlMapper } from './promql';

function root(graph: QueryFlowGraph): QueryFlowNode {
  return graph.nodes[graph.rootId];
}

function childAt(graph: QueryFlowGraph, node: QueryFlowNode, index = 0): QueryFlowNode {
  return graph.nodes[node.childIds[index]];
}

function findByLabel(graph: QueryFlowGraph, label: string): QueryFlowNode | undefined {
  return Object.values(graph.nodes).find((node) => node.label === label);
}

describe('promqlMapper', () => {
  const CANONICAL =
    'histogram_quantile(0.99, sum by (le) (rate(datadog_proxy_request_duration_seconds_bucket{cluster="ops-us-east-0",namespace="dd-ops-01"}[$__rate_interval])) unless on(container) absent(datadog_proxy_build_unix_timestamp{cluster="ops-us-east-0"}))';

  it('maps the canonical query into the expected flow graph', () => {
    const graph = promqlMapper.buildGraph(CANONICAL);

    // Root: histogram_quantile with the 0.99 quantile captured as a param, not a child node.
    const hq = root(graph);
    expect(hq.kind).toBe(QueryFlowNodeKind.Function);
    expect(hq.label).toBe('histogram_quantile');
    expect(hq.params?.map((p) => p.value)).toContain('0.99');
    expect(hq.childIds).toHaveLength(1);

    // Binary `unless on(container)` join.
    const binary = childAt(graph, hq);
    expect(binary.kind).toBe(QueryFlowNodeKind.Binary);
    expect(binary.label).toBe('unless');
    expect(binary.sublabel).toContain('on(container)');
    expect(binary.childIds).toHaveLength(2);

    // Left operand: sum by (le) -> rate -> range -> selector.
    const aggregation = findByLabel(graph, 'sum');
    expect(aggregation?.kind).toBe(QueryFlowNodeKind.Aggregation);
    expect(aggregation?.sublabel).toBe('by (le)');

    const rate = findByLabel(graph, 'rate');
    expect(rate?.kind).toBe(QueryFlowNodeKind.Function);
    expect(aggregation && childAt(graph, aggregation).id).toBe(rate?.id);

    const range = rate && childAt(graph, rate);
    expect(range?.kind).toBe(QueryFlowNodeKind.Range);
    // The template variable is restored to its original form (proves span-mapping back to source).
    expect(range?.label).toBe('[$__rate_interval]');

    const selector = range && childAt(graph, range);
    expect(selector?.kind).toBe(QueryFlowNodeKind.Selector);
    expect(selector?.label).toBe('datadog_proxy_request_duration_seconds_bucket');
    expect(selector?.params?.map((p) => p.key)).toEqual(['cluster', 'namespace']);

    // Right operand: absent(...) wrapping a second selector.
    const absent = findByLabel(graph, 'absent');
    expect(absent?.kind).toBe(QueryFlowNodeKind.Function);
    const absentSelector = absent && childAt(graph, absent);
    expect(absentSelector?.label).toBe('datadog_proxy_build_unix_timestamp');

    // The variable-in-duration parse artifact must not be surfaced as an error.
    expect(graph.errors).toHaveLength(0);
  });

  it('keeps node spans pointing at the original (pre variable-replace) text', () => {
    const graph = promqlMapper.buildGraph('rate(http_requests_total{job="api"}[$__rate_interval])');
    for (const node of Object.values(graph.nodes)) {
      // Every span must index real original text; selectors/ranges must round-trip exactly.
      expect(node.span.to).toBeLessThanOrEqual('rate(http_requests_total{job="api"}[$__rate_interval])'.length);
      expect(node.span.from).toBeLessThanOrEqual(node.span.to);
    }
    const selector = findByLabel(graph, 'http_requests_total');
    const matcher = selector?.params?.[0];
    expect(matcher?.value).toBe('job="api"');
    expect(
      matcher?.span &&
        'rate(http_requests_total{job="api"}[$__rate_interval])'.slice(matcher.span.from, matcher.span.to)
    ).toBe('job="api"');
  });

  it('reports a real syntax error but still returns a partial graph', () => {
    const graph = promqlMapper.buildGraph('sum(rate(metric[5m])');
    expect(graph.errors.length).toBeGreaterThan(0);
    expect(graph.rootId).not.toBe('');
  });

  it('returns an empty graph for an empty query', () => {
    const graph = promqlMapper.buildGraph('');
    expect(graph.rootId).toBe('');
    expect(graph.errors).toHaveLength(0);
  });

  it('represents an offset modifier as its own node instead of dropping it', () => {
    const graph = promqlMapper.buildGraph('metric{job="api"} offset 5m');

    const modifier = root(graph);
    expect(modifier.kind).toBe(QueryFlowNodeKind.Modifier);
    expect(modifier.label).toBe('offset 5m');

    const selector = childAt(graph, modifier);
    expect(selector.kind).toBe(QueryFlowNodeKind.Selector);
    expect(selector.label).toBe('metric');
  });

  it('represents an @ modifier as its own node instead of dropping it', () => {
    const graph = promqlMapper.buildGraph('metric{job="api"} @ start()');

    const modifier = root(graph);
    expect(modifier.kind).toBe(QueryFlowNodeKind.Modifier);
    expect(modifier.label).toBe('@ start()');

    const selector = childAt(graph, modifier);
    expect(selector.kind).toBe(QueryFlowNodeKind.Selector);
  });

  it('represents a subquery range the same way as a matrix selector range', () => {
    const graph = promqlMapper.buildGraph('rate(metric[5m:1m])');

    const rate = root(graph);
    expect(rate.kind).toBe(QueryFlowNodeKind.Function);

    const range = childAt(graph, rate);
    expect(range.kind).toBe(QueryFlowNodeKind.Range);
    expect(range.label).toBe('[5m:1m]');

    const selector = childAt(graph, range);
    expect(selector.kind).toBe(QueryFlowNodeKind.Selector);
    expect(selector.label).toBe('metric');
  });

  it('passes through a unary expression to its inner selector (sign is not yet surfaced)', () => {
    const graph = promqlMapper.buildGraph('-metric');
    const node = root(graph);
    expect(node.kind).toBe(QueryFlowNodeKind.Selector);
    expect(node.label).toBe('metric');
  });

  it('captures a binary matching modifier with group_left as the binary node sublabel', () => {
    const graph = promqlMapper.buildGraph('a * on(job) group_left(env) b');

    const binary = root(graph);
    expect(binary.kind).toBe(QueryFlowNodeKind.Binary);
    expect(binary.label).toBe('*');
    expect(binary.sublabel).toBe('on(job) group_left(env)');
    expect(binary.childIds).toHaveLength(2);
  });

  it('keeps an offset modifier visible even nested inside a range vector function', () => {
    const graph = promqlMapper.buildGraph('rate(metric[5m] offset 1h)');

    const rate = root(graph);
    expect(rate.kind).toBe(QueryFlowNodeKind.Function);

    const modifier = childAt(graph, rate);
    expect(modifier.kind).toBe(QueryFlowNodeKind.Modifier);
    expect(modifier.label).toBe('offset 1h');

    const range = childAt(graph, modifier);
    expect(range.kind).toBe(QueryFlowNodeKind.Range);
    expect(range.label).toBe('[5m]');
  });
});
