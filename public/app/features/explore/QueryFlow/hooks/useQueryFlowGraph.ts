import { useMemo, useRef } from 'react';

import { getMapperForDatasourceType } from '../model/registry';
import { isEmptyGraph, type QueryFlowGraph, type QueryFlowStatus } from '../model/types';

export interface QueryFlowResult {
  graph?: QueryFlowGraph;
  status: QueryFlowStatus;
}

/**
 * Parse `expr` into a graph on every change so the canvas builds up live as the user types. Parsing
 * is cheap (lezer) and error-tolerant, so partial/in-progress queries still render. While a query is
 * empty or momentarily unparseable, the last valid graph is kept on screen (status `stale`) rather
 * than blanking the canvas.
 */
export function useQueryFlowGraph(expr: string, datasourceType: string | undefined): QueryFlowResult {
  const lastValid = useRef<QueryFlowGraph | undefined>(undefined);
  const lastDatasourceType = useRef(datasourceType);

  return useMemo<QueryFlowResult>(() => {
    // A "last valid" graph from another datasource is another language's graph — never show it as
    // `stale` for this one (e.g. a PromQL tree lingering after the pane switched to Loki).
    if (lastDatasourceType.current !== datasourceType) {
      lastDatasourceType.current = datasourceType;
      lastValid.current = undefined;
    }
    const mapper = getMapperForDatasourceType(datasourceType);
    if (!mapper) {
      return { status: 'unsupported' };
    }
    if (!expr.trim()) {
      return { status: 'empty' };
    }

    const graph = mapper.buildGraph(expr);
    if (isEmptyGraph(graph)) {
      return { status: lastValid.current ? 'stale' : 'empty', graph: lastValid.current };
    }

    lastValid.current = graph;
    return { status: graph.errors.length > 0 ? 'partial' : 'valid', graph };
  }, [expr, datasourceType]);
}
