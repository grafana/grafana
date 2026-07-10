export type QueryFlowLanguage = 'promql' | 'logql';

/** Half-open range [from, to) into the ORIGINAL query text (before variable replacement). */
export interface SourceSpan {
  from: number;
  to: number;
}

/**
 * Coarse, language-agnostic taxonomy. Per-language detail lives in `label`/`sublabel`/`params`,
 * so the renderer stays language-agnostic and only switches styling on `kind`.
 */
export enum QueryFlowNodeKind {
  Selector = 'selector', // PromQL vector selector / LogQL stream selector {…}
  Range = 'range', // PromQL matrix selector / LogQL log range ([5m])
  Aggregation = 'aggregation', // sum by(…), avg without(…)
  Function = 'function', // rate(), histogram_quantile(), count_over_time()
  Binary = 'binary', // a unless on(…) b, a + b
  Modifier = 'modifier', // PromQL offset 5m / @ start() time modifiers
  LineFilter = 'lineFilter', // LogQL |= "x"
  Parser = 'parser', // LogQL json / logfmt / regexp / pattern
  LabelFilter = 'labelFilter', // LogQL | level="error"
  LabelFormat = 'labelFormat', // LogQL line_format / label_format
  Literal = 'literal', // scalar / string constant
  Unknown = 'unknown', // graceful fallback for unmapped subtrees
}

export interface QueryFlowParam {
  /** e.g. a label name, "by", "window". Optional when only the value is meaningful. */
  key?: string;
  value: string;
  /** Span of this param into the original text — enables future fine-grained editing. */
  span?: SourceSpan;
}

export interface QueryFlowNode {
  /** Stable within one graph build, derived from kind + span. */
  id: string;
  kind: QueryFlowNodeKind;
  language: QueryFlowLanguage;
  label: string;
  sublabel?: string;
  params?: QueryFlowParam[];
  /** Span of the whole subexpression this node represents — the editability hinge (string-splice). */
  span: SourceSpan;
  /** Ordered child node ids. Edges are derived from this. */
  childIds: string[];
  /**
   * True when this node has no corresponding source text — the mapper inserted it as a placeholder
   * for a required-but-missing construct (e.g. a LogQL range without `[..]`, recovered by the
   * grammar as an empty node). Diagnostics should check this instead of scanning source text, since
   * text scanning can't tell a placeholder apart from a construct that's merely absent-looking.
   */
  synthetic?: boolean;
}

export interface QueryFlowParseError {
  message: string;
  span?: SourceSpan;
}

export interface QueryFlowGraph {
  language: QueryFlowLanguage;
  /** Id of the outermost expression node. Empty string when nothing usable parsed. */
  rootId: string;
  nodes: Record<string, QueryFlowNode>;
  errors: QueryFlowParseError[];
}

export function isEmptyGraph(graph: QueryFlowGraph | undefined): boolean {
  return !graph || !graph.rootId || !graph.nodes[graph.rootId];
}

/** UI state of the live parse, used to drive a non-blocking status indicator. */
export type QueryFlowStatus = 'empty' | 'valid' | 'partial' | 'stale' | 'unsupported';
