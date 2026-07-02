import { t } from '@grafana/i18n';

import { docsLinkFor } from '../docs/docsLinks';
import { type QueryFlowGraph, type QueryFlowParseError, type SourceSpan } from '../model/types';

import { getRulesForLanguage } from './registry';
import { type QueryFlowDiagnostic } from './types';

/**
 * Analyze a parsed graph into live diagnostics: syntax errors (from the parser) plus the language's
 * semantic lint rules. Pure and synchronous — safe to call on every graph rebuild.
 */
export function analyzeGraph(graph: QueryFlowGraph, expr: string): QueryFlowDiagnostic[] {
  const diagnostics: QueryFlowDiagnostic[] = [];

  graph.errors.forEach((error, index) => {
    diagnostics.push(syntaxDiagnostic(graph, error, index));
  });

  for (const rule of getRulesForLanguage(graph.language)) {
    try {
      diagnostics.push(...rule(graph, expr));
    } catch {
      // A misbehaving rule must never break the panel.
    }
  }

  // Attach the anchored node's docs link centrally, so individual rules don't each need to know
  // about docsLinkFor — a rule can still set its own `docsHref` for a more specific target.
  for (const diagnostic of diagnostics) {
    if (diagnostic.docsHref) {
      continue;
    }
    const node = graph.nodes[diagnostic.nodeId];
    if (node) {
      diagnostic.docsHref = docsLinkFor(node);
    }
  }

  return diagnostics;
}

function syntaxDiagnostic(graph: QueryFlowGraph, error: QueryFlowParseError, index: number): QueryFlowDiagnostic {
  const nodeId = (error.span && findNodeIdForSpan(graph, error.span)) || graph.rootId;
  return {
    id: `syntax-${index}`,
    nodeId,
    severity: 'error',
    message: error.message || t('explore.query-flow.diagnostics.syntax-error', 'Syntax error'),
  };
}

/** Smallest node whose span fully contains the given span (most specific anchor). */
function findNodeIdForSpan(graph: QueryFlowGraph, span: SourceSpan): string | undefined {
  let best: { id: string; width: number } | undefined;
  for (const id of Object.keys(graph.nodes)) {
    const node = graph.nodes[id];
    if (node.span.from <= span.from && span.to <= node.span.to) {
      const width = node.span.to - node.span.from;
      if (!best || width < best.width) {
        best = { id, width };
      }
    }
  }
  return best?.id;
}
