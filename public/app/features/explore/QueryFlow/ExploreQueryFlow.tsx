import { useCallback, useMemo } from 'react';

import { reportInteraction } from '@grafana/runtime';

import { QueryFlowPanel } from './QueryFlowPanel';
import { analyzeGraph } from './diagnostics/analyze';
import { useActiveQueryFlowQuery } from './hooks/useActiveQueryFlowQuery';
import { useEditorHighlight } from './hooks/useEditorHighlight';
import { useQueryFlowEnrichment } from './hooks/useQueryFlowEnrichment';
import { useQueryFlowGraph } from './hooks/useQueryFlowGraph';

interface Props {
  exploreId: string;
  refId: string;
  onClose: () => void;
}

export function ExploreQueryFlow({ exploreId, refId, onClose }: Props) {
  const { expr, datasourceType, datasourceUid } = useActiveQueryFlowQuery(exploreId, refId);
  const { graph, status } = useQueryFlowGraph(expr, datasourceType);
  const { getEnrichment, requestEnrichment } = useQueryFlowEnrichment({
    graph,
    exploreId,
    refId,
    expr,
    datasourceType,
    datasourceUid,
  });

  const diagnostics = useMemo(() => (graph ? analyzeGraph(graph, expr) : []), [graph, expr]);

  const highlight = useEditorHighlight({ expr, refId });
  const onNodeHover = useCallback(
    (nodeId: string | null) => highlight(nodeId ? graph?.nodes[nodeId] : undefined),
    [graph, highlight]
  );

  // A single close-time snapshot (rather than reporting on every keystroke/graph rebuild) captures
  // how useful the panel was for this session without spamming an event on every recomputed graph.
  const handleClose = useCallback(() => {
    reportInteraction('grafana_explore_query_flow_close', {
      status,
      errorCount: diagnostics.filter((d) => d.severity === 'error' || d.severity === 'warning').length,
      tipCount: diagnostics.filter((d) => d.severity === 'tip').length,
    });
    onClose();
  }, [status, diagnostics, onClose]);

  return (
    <QueryFlowPanel
      graph={graph}
      status={status}
      refId={refId}
      diagnostics={diagnostics}
      onClose={handleClose}
      getEnrichment={getEnrichment}
      onRequestEnrichment={requestEnrichment}
      onNodeHover={onNodeHover}
    />
  );
}
