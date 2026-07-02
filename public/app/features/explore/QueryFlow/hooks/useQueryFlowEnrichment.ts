import { useCallback, useEffect, useRef, useState } from 'react';

import { getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { type StoreState, useSelector } from 'app/types/store';

import { getEnricherForDatasourceType } from '../enrichment/registry';
import { type EnrichmentContext, type NodeEnrichment } from '../enrichment/types';
import { type QueryFlowGraph } from '../model/types';

export interface QueryFlowEnrichmentParams {
  graph: QueryFlowGraph | undefined;
  exploreId: string;
  /** Active query refId, used to locate its result frames. */
  refId: string;
  /** Original query text — node spans index into this. */
  expr: string;
  datasourceType: string | undefined;
  datasourceUid: string | undefined;
}

export interface QueryFlowEnrichmentResult {
  /** Current enrichment for a node, or undefined if it hasn't been requested yet. */
  getEnrichment: (nodeId: string) => NodeEnrichment | undefined;
  /** Lazily fetch a node's enrichment (idempotent) — call on hover/focus. */
  requestEnrichment: (nodeId: string) => void;
}

/**
 * Lazily fetches per-node enrichment on demand and caches it. Per-node overlays are dropped when the
 * query text, time range, or query result changes. Nothing is fetched until `requestEnrichment` runs.
 */
export function useQueryFlowEnrichment(params: QueryFlowEnrichmentParams): QueryFlowEnrichmentResult {
  const { graph, exploreId, refId, expr, datasourceType, datasourceUid } = params;
  const range = useSelector((state: StoreState) => state.explore.panes[exploreId]?.range);
  const queryResponse = useSelector((state: StoreState) => state.explore.panes[exploreId]?.queryResponse);

  const [enrichments, setEnrichments] = useState<Record<string, NodeEnrichment>>({});
  const enrichmentsRef = useRef(enrichments);
  enrichmentsRef.current = enrichments;

  const rangeKey = range ? `${range.from.valueOf()}:${range.to.valueOf()}` : '';
  // Bump whenever inputs that invalidate enrichment change, so async fetches started against a
  // stale input can detect they're outdated and avoid clobbering fresher data (or an already-reset
  // cache) when they resolve out of order.
  const generationRef = useRef(0);
  // `requestId` changes on every query execution (including re-runs that produce identical data),
  // unlike `state`, which can settle back to the same value without a fresh request happening.
  const responseKey = queryResponse?.request?.requestId ?? '';

  // Per-node overlays depend on the query text, time range, and result — drop them when any changes.
  useEffect(() => {
    generationRef.current += 1;
    // Bail with the same reference when there's nothing to clear, so an input that changes on every
    // render (e.g. a live "now"-relative range) can't drive a setState-per-render loop.
    setEnrichments((prev) => (Object.keys(prev).length === 0 ? prev : {}));
  }, [expr, datasourceUid, rangeKey, responseKey]);

  const requestEnrichment = useCallback(
    (nodeId: string) => {
      const node = graph?.nodes[nodeId];
      const enricher = getEnricherForDatasourceType(datasourceType);
      const cached = enrichmentsRef.current[nodeId];
      // Allow retrying after a failure — everything else (loading/done) is served from cache.
      if (!node || !enricher || !range || !datasourceUid || (cached && cached.state !== 'error')) {
        return;
      }
      const generation = generationRef.current;
      // Reported once per genuinely new fetch (not on re-hovers of an already-cached node), so this
      // reflects real engagement with the enrichment feature rather than raw hover noise.
      reportInteraction('grafana_explore_query_flow_node_hover', { nodeKind: node.kind });
      setEnrichments((prev) => ({ ...prev, [nodeId]: { state: 'loading' } }));

      (async () => {
        try {
          const datasource = await getDataSourceSrv().get(datasourceUid);
          const ctx: EnrichmentContext = {
            datasource,
            timeRange: range,
            expr,
            refId,
            isRoot: nodeId === graph?.rootId,
            queryResponse,
          };
          const result = await enricher.enrichNode(node, ctx);
          if (generationRef.current !== generation) {
            return;
          }
          setEnrichments((prev) => ({ ...prev, [nodeId]: result ?? { state: 'done' } }));
        } catch {
          if (generationRef.current !== generation) {
            return;
          }
          setEnrichments((prev) => ({ ...prev, [nodeId]: { state: 'error' } }));
        }
      })();
    },
    [graph, datasourceType, datasourceUid, range, expr, refId, queryResponse]
  );

  const getEnrichment = useCallback((nodeId: string) => enrichments[nodeId], [enrichments]);

  return { getEnrichment, requestEnrichment };
}
