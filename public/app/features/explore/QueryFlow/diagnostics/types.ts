import { type QueryFlowGraph } from '../model/types';

export type DiagnosticSeverity = 'error' | 'warning' | 'tip';

/** A single piece of live feedback anchored to one graph node. */
export interface QueryFlowDiagnostic {
  /** Stable id (rule + nodeId) so React keys and dedupe behave. */
  id: string;
  /** Node the callout anchors to. */
  nodeId: string;
  severity: DiagnosticSeverity;
  message: string;
  /** Optional "did you mean ..." snippet shown in monospace. */
  suggestion?: string;
  /** Documentation link for the anchored node's kind/function, filled in by `analyzeGraph`. */
  docsHref?: string;
}

/**
 * A pure analysis pass over a parsed graph. Receives the original `expr` so rules can slice node
 * spans to build suggestions. Must never throw.
 */
export type DiagnosticRule = (graph: QueryFlowGraph, expr: string) => QueryFlowDiagnostic[];
