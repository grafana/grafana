import { type QueryFlowGraph, type QueryFlowNode, QueryFlowNodeKind } from '../types';

import { logqlMapper } from './logql';

function root(graph: QueryFlowGraph): QueryFlowNode {
  return graph.nodes[graph.rootId];
}

function childAt(graph: QueryFlowGraph, node: QueryFlowNode, index = 0): QueryFlowNode {
  return graph.nodes[node.childIds[index]];
}

describe('logqlMapper', () => {
  it('maps a metric query with a pipeline into a chained flow graph', () => {
    const graph = logqlMapper.buildGraph('sum by (level) (rate({app="api"} |= "error" | logfmt | status>=500 [5m]))');

    const sum = root(graph);
    expect(sum.kind).toBe(QueryFlowNodeKind.Aggregation);
    expect(sum.label).toBe('sum');
    expect(sum.sublabel).toBe('by (level)');

    const rate = childAt(graph, sum);
    expect(rate.kind).toBe(QueryFlowNodeKind.Function);
    expect(rate.label).toBe('rate');

    const range = childAt(graph, rate);
    expect(range.kind).toBe(QueryFlowNodeKind.Range);
    expect(range.label).toBe('[5m]');

    // Pipeline chains downwards: range -> label filter -> parser -> line filter -> selector.
    const labelFilter = childAt(graph, range);
    expect(labelFilter.kind).toBe(QueryFlowNodeKind.LabelFilter);
    expect(labelFilter.label).toBe('status>=500');

    const parser = childAt(graph, labelFilter);
    expect(parser.kind).toBe(QueryFlowNodeKind.Parser);
    expect(parser.label).toBe('logfmt');

    const lineFilter = childAt(graph, parser);
    expect(lineFilter.kind).toBe(QueryFlowNodeKind.LineFilter);
    expect(lineFilter.label).toBe('|= "error"');

    const selector = childAt(graph, lineFilter);
    expect(selector.kind).toBe(QueryFlowNodeKind.Selector);
    expect(selector.params?.map((p) => p.key)).toEqual(['app']);

    expect(graph.errors).toHaveLength(0);
  });

  it('maps a log query pipeline (selector -> line filter -> parser -> line_format)', () => {
    const graph = logqlMapper.buildGraph('{app="api"} |= "error" | json | line_format "{{.msg}}"');

    const lineFormat = root(graph);
    expect(lineFormat.kind).toBe(QueryFlowNodeKind.LabelFormat);
    expect(lineFormat.label).toContain('line_format');

    const json = childAt(graph, lineFormat);
    expect(json.kind).toBe(QueryFlowNodeKind.Parser);
    expect(json.label).toBe('json');

    const lineFilter = childAt(graph, json);
    expect(lineFilter.kind).toBe(QueryFlowNodeKind.LineFilter);

    const selector = childAt(graph, lineFilter);
    expect(selector.kind).toBe(QueryFlowNodeKind.Selector);

    expect(graph.errors).toHaveLength(0);
  });

  it('returns an empty graph for an empty query', () => {
    const graph = logqlMapper.buildGraph('');
    expect(graph.rootId).toBe('');
  });

  it('marks a Range node synthetic when [..] is missing, even if the selector contains a bracket', () => {
    const graph = logqlMapper.buildGraph('rate({msg="foo[bar]"})');

    const rate = root(graph);
    expect(rate.kind).toBe(QueryFlowNodeKind.Function);

    const range = childAt(graph, rate);
    expect(range.kind).toBe(QueryFlowNodeKind.Range);
    expect(range.synthetic).toBe(true);
  });

  it('does not mark a Range node synthetic when [..] is present', () => {
    const graph = logqlMapper.buildGraph('rate({app="api"}[5m])');

    const range = childAt(graph, root(graph));
    expect(range.kind).toBe(QueryFlowNodeKind.Range);
    expect(range.synthetic).toBeFalsy();
  });

  it('reports a real syntax error but still returns a partial graph', () => {
    const graph = logqlMapper.buildGraph('{app="api"} | json |');
    expect(graph.errors.length).toBeGreaterThan(0);
    expect(graph.rootId).not.toBe('');
  });

  it('does not report an error for a well-formed query', () => {
    const graph = logqlMapper.buildGraph('{app="api"} | json | level="error"');
    expect(graph.errors).toHaveLength(0);
  });

  it('restores a template variable in a selector to its original form', () => {
    const graph = logqlMapper.buildGraph('{app="$app"}');
    const selector = root(graph);
    expect(selector.kind).toBe(QueryFlowNodeKind.Selector);
    expect(selector.params?.[0]?.value).toBe('app="$app"');
    expect(graph.errors).toHaveLength(0);
  });

  it('maps label_replace wrapping a metric expression', () => {
    const graph = logqlMapper.buildGraph('label_replace(rate({app="foo"}[5m]), "new", "$1", "old", "(.*)")');

    const labelReplace = root(graph);
    expect(labelReplace.kind).toBe(QueryFlowNodeKind.Function);
    expect(labelReplace.label).toBe('label_replace');

    const rate = childAt(graph, labelReplace);
    expect(rate.kind).toBe(QueryFlowNodeKind.Function);
    expect(rate.label).toBe('rate');
  });

  it('chains a binary op between two independent range aggregations', () => {
    const graph = logqlMapper.buildGraph('count_over_time({a="1"}[5m]) / count_over_time({b="2"}[5m])');

    const binary = root(graph);
    expect(binary.kind).toBe(QueryFlowNodeKind.Binary);
    expect(binary.label).toBe('/');
    expect(binary.childIds).toHaveLength(2);

    const left = childAt(graph, binary, 0);
    const right = childAt(graph, binary, 1);
    expect(left.kind).toBe(QueryFlowNodeKind.Function);
    expect(right.kind).toBe(QueryFlowNodeKind.Function);
  });

  it('combines multiple chained line filters into one LineFilter node (current pipeline-stage granularity)', () => {
    // The grammar nests consecutive line filters (`|= "err" != "ignore"`) inside a single
    // PipelineStage, so today they render as one node with both filters in its label rather than
    // two chained nodes — documenting this rather than a finer-grained split that doesn't exist yet.
    const graph = logqlMapper.buildGraph('{app="foo"} |= "err" != "ignore"');

    const lineFilter = root(graph);
    expect(lineFilter.kind).toBe(QueryFlowNodeKind.LineFilter);
    expect(lineFilter.label).toBe('|= "err" != "ignore"');

    const selector = childAt(graph, lineFilter);
    expect(selector.kind).toBe(QueryFlowNodeKind.Selector);
  });

  it('represents | unwrap as its own stage instead of silently dropping it', () => {
    const graph = logqlMapper.buildGraph('sum_over_time({app="foo"} | unwrap duration [5m])');

    const sum = root(graph);
    expect(sum.kind).toBe(QueryFlowNodeKind.Function);

    const range = childAt(graph, sum);
    expect(range.kind).toBe(QueryFlowNodeKind.Range);

    const unwrap = childAt(graph, range);
    expect(unwrap.kind).toBe(QueryFlowNodeKind.Parser);
    expect(unwrap.label).toBe('| unwrap duration');

    const selector = childAt(graph, unwrap);
    expect(selector.kind).toBe(QueryFlowNodeKind.Selector);
  });

  it('chains | unwrap after a preceding parser stage', () => {
    const graph = logqlMapper.buildGraph('sum_over_time({app="foo"} | json | unwrap duration [5m])');

    const range = childAt(graph, root(graph));
    const unwrap = childAt(graph, range);
    expect(unwrap.kind).toBe(QueryFlowNodeKind.Parser);
    expect(unwrap.label).toBe('| unwrap duration');

    const jsonParser = childAt(graph, unwrap);
    expect(jsonParser.kind).toBe(QueryFlowNodeKind.Parser);
    expect(jsonParser.label).toBe('json');

    const selector = childAt(graph, jsonParser);
    expect(selector.kind).toBe(QueryFlowNodeKind.Selector);
  });
});
