import { type QueryFlowNode, QueryFlowNodeKind } from '../model/types';

const PROM_BASE = 'https://prometheus.io/docs/prometheus/latest/querying';
const LOKI_BASE = 'https://grafana.com/docs/loki/latest/query';

// Section-level docs per node kind. Functions are handled separately so we can deep-link by name.
const PROM_LINKS: Partial<Record<QueryFlowNodeKind, string>> = {
  [QueryFlowNodeKind.Selector]: `${PROM_BASE}/basics/#instant-vector-selectors`,
  [QueryFlowNodeKind.Range]: `${PROM_BASE}/basics/#range-vector-selectors`,
  [QueryFlowNodeKind.Aggregation]: `${PROM_BASE}/operators/#aggregation-operators`,
  [QueryFlowNodeKind.Binary]: `${PROM_BASE}/operators/#binary-operators`,
  [QueryFlowNodeKind.Modifier]: `${PROM_BASE}/basics/#offset-modifier`,
};

const LOKI_LINKS: Partial<Record<QueryFlowNodeKind, string>> = {
  [QueryFlowNodeKind.Selector]: `${LOKI_BASE}/log_queries/#log-stream-selector`,
  [QueryFlowNodeKind.Range]: `${LOKI_BASE}/metric_queries/#range-aggregation`,
  [QueryFlowNodeKind.Function]: `${LOKI_BASE}/metric_queries/`,
  [QueryFlowNodeKind.Aggregation]: `${LOKI_BASE}/metric_queries/#vector-aggregation`,
  [QueryFlowNodeKind.Binary]: `${LOKI_BASE}/#binary-operators`,
  [QueryFlowNodeKind.LineFilter]: `${LOKI_BASE}/log_queries/#line-filter-expression`,
  [QueryFlowNodeKind.Parser]: `${LOKI_BASE}/log_queries/#parser-expression`,
  [QueryFlowNodeKind.LabelFilter]: `${LOKI_BASE}/log_queries/#label-filter-expression`,
  [QueryFlowNodeKind.LabelFormat]: `${LOKI_BASE}/log_queries/#line-format-expression`,
};

// Escape hatch for the rare token whose auto-derived anchor is wrong. Keyed by `${language}:${label}`.
const OVERRIDES: Record<string, string> = {};

/**
 * Documentation URL for a node, or undefined when there's nothing useful to link (e.g. literals).
 * Prometheus function anchors equal the function name, so `functions/#<label>` deep-links for free.
 */
export function docsLinkFor(node: QueryFlowNode): string | undefined {
  const override = OVERRIDES[`${node.language}:${node.label}`];
  if (override) {
    return override;
  }

  if (node.language === 'promql') {
    if (node.kind === QueryFlowNodeKind.Function) {
      return `${PROM_BASE}/functions/#${node.label.toLowerCase()}`;
    }
    return PROM_LINKS[node.kind];
  }

  return LOKI_LINKS[node.kind];
}
