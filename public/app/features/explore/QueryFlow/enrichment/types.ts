import { type DataSourceApi, type PanelData, type TimeRange } from '@grafana/data';

import { type QueryFlowNode } from '../model/types';

/** One labelled row in a node's enrichment tooltip. */
export interface EnrichmentRow {
  label: string;
  value: string;
}

/** Lifecycle of a single node's lazy enrichment fetch, used to drive badge/spinner UI. */
export type EnrichmentState = 'idle' | 'loading' | 'done' | 'error';

/** Tone hint for the badge so the renderer can highlight warnings (high cardinality, parse errors). */
export type EnrichmentSeverity = 'info' | 'warning' | 'error';

/** Live, lazily-fetched data overlaid on one graph node. Plain data — no JSX — so enrichers stay testable. */
export interface NodeEnrichment {
  state: EnrichmentState;
  /** Short text shown as the node's corner badge (e.g. "counter", "12 streams · 4 MB"). */
  badge?: string;
  severity?: EnrichmentSeverity;
  /** Structured rows shown in the node's hover tooltip. */
  rows?: EnrichmentRow[];
  /** Free-text note shown above the rows (e.g. metric help text, a query hint). */
  note?: string;
}

export interface EnrichmentContext {
  /** Resolved instance for the active query's datasource (narrowed by each enricher). */
  datasource: DataSourceApi;
  timeRange: TimeRange;
  /** Original query text; slice with `node.span` to recover a node's sub-expression. */
  expr: string;
  /** Active query refId, used to locate its frames in `queryResponse`. */
  refId: string;
  /** Whether this node is the graph root — gates root-only overlays (result count, query cost). */
  isRoot: boolean;
  /** Already-run query result, when present — free stats (Loki) and hints live here. */
  queryResponse?: PanelData;
}

export interface QueryFlowEnricher {
  /** Datasource `type` this enricher handles (`prometheus` | `loki`). */
  datasourceType: string;
  /**
   * Fetch live enrichment for one node. Lazy — invoked on demand (hover/focus). Resolves `undefined`
   * when the node kind has nothing to enrich. Must never reject: surface failures as `state: 'error'`.
   */
  enrichNode(node: QueryFlowNode, ctx: EnrichmentContext): Promise<NodeEnrichment | undefined>;
}
