import { logqlMapper } from '../model/languages/logql';
import { promqlMapper } from '../model/languages/promql';
import { type QueryFlowGraph, type QueryFlowNode, QueryFlowNodeKind } from '../model/types';

import { docsLinkFor } from './docsLinks';

const find = (graph: QueryFlowGraph, pred: (node: QueryFlowNode) => boolean): QueryFlowNode => {
  const node = Object.values(graph.nodes).find(pred);
  if (!node) {
    throw new Error('node not found');
  }
  return node;
};

describe('docsLinkFor - Prometheus', () => {
  const graph = promqlMapper.buildGraph('histogram_quantile(0.99, sum by (le) (rate(metric{job="api"}[5m])))');

  it('deep-links functions by name', () => {
    const rate = find(graph, (n) => n.kind === QueryFlowNodeKind.Function && n.label === 'rate');
    expect(docsLinkFor(rate)).toBe('https://prometheus.io/docs/prometheus/latest/querying/functions/#rate');
    const hq = find(graph, (n) => n.kind === QueryFlowNodeKind.Function && n.label === 'histogram_quantile');
    expect(docsLinkFor(hq)).toBe('https://prometheus.io/docs/prometheus/latest/querying/functions/#histogram_quantile');
  });

  it('links aggregations, selectors and ranges to their sections', () => {
    const sum = find(graph, (n) => n.kind === QueryFlowNodeKind.Aggregation);
    expect(docsLinkFor(sum)).toBe(
      'https://prometheus.io/docs/prometheus/latest/querying/operators/#aggregation-operators'
    );
    const selector = find(graph, (n) => n.kind === QueryFlowNodeKind.Selector);
    expect(docsLinkFor(selector)).toBe(
      'https://prometheus.io/docs/prometheus/latest/querying/basics/#instant-vector-selectors'
    );
    const range = find(graph, (n) => n.kind === QueryFlowNodeKind.Range);
    expect(docsLinkFor(range)).toBe(
      'https://prometheus.io/docs/prometheus/latest/querying/basics/#range-vector-selectors'
    );
  });

  it('returns undefined for literals', () => {
    const binary = promqlMapper.buildGraph('metric * 2');
    const literal = find(binary, (n) => n.kind === QueryFlowNodeKind.Literal);
    expect(docsLinkFor(literal)).toBeUndefined();
  });

  it('links the offset/@ modifier to the modifiers section', () => {
    const modifierGraph = promqlMapper.buildGraph('metric{job="api"} offset 5m');
    const modifier = find(modifierGraph, (n) => n.kind === QueryFlowNodeKind.Modifier);
    expect(docsLinkFor(modifier)).toBe('https://prometheus.io/docs/prometheus/latest/querying/basics/#offset-modifier');
  });
});

describe('docsLinkFor - Loki', () => {
  it('links range aggregations and stream selectors', () => {
    const graph = logqlMapper.buildGraph('rate({app="foo"}[5m])');
    const fn = find(graph, (n) => n.kind === QueryFlowNodeKind.Function && n.label === 'rate');
    expect(docsLinkFor(fn)).toBe('https://grafana.com/docs/loki/latest/query/metric_queries/');
    const selector = find(graph, (n) => n.kind === QueryFlowNodeKind.Selector);
    expect(docsLinkFor(selector)).toBe('https://grafana.com/docs/loki/latest/query/log_queries/#log-stream-selector');
  });

  it('links pipeline stages to log query sections', () => {
    const graph = logqlMapper.buildGraph('{app="foo"} |= "err" | json');
    const lineFilter = find(graph, (n) => n.kind === QueryFlowNodeKind.LineFilter);
    expect(docsLinkFor(lineFilter)).toBe(
      'https://grafana.com/docs/loki/latest/query/log_queries/#line-filter-expression'
    );
    const parser = find(graph, (n) => n.kind === QueryFlowNodeKind.Parser);
    expect(docsLinkFor(parser)).toBe('https://grafana.com/docs/loki/latest/query/log_queries/#parser-expression');
  });
});
