import { type DataQuery } from '@grafana/schema';
import { type StoreState, useSelector } from 'app/types/store';

export interface QueryFlowQueryData {
  /** The query's expression (`expr` for both Prometheus and Loki). Empty when none. */
  expr: string;
  /** Datasource `type` for the query, used to pick a language mapper. */
  datasourceType: string | undefined;
  /** Datasource `uid` for the query, used to resolve the instance for node enrichment. */
  datasourceUid: string | undefined;
}

/** Reads a single query's text and datasource type for a pane, live as the user edits. */
export function useActiveQueryFlowQuery(exploreId: string, refId: string): QueryFlowQueryData {
  // Selecting only the matching query (rather than the whole `queries` array) means this only
  // re-renders when this specific query's object reference changes — editing query B no longer
  // re-renders an open flow panel for query A.
  const query = useSelector((state: StoreState) =>
    state.explore.panes[exploreId]?.queries?.find((q) => q.refId === refId)
  );
  const paneDatasource = useSelector((state: StoreState) => state.explore.panes[exploreId]?.datasourceInstance);

  return {
    expr: getExpr(query),
    datasourceType: query?.datasource?.type ?? paneDatasource?.type,
    datasourceUid: query?.datasource?.uid ?? paneDatasource?.uid,
  };
}

function getExpr(query: DataQuery | undefined): string {
  if (query && 'expr' in query && typeof query.expr === 'string') {
    return query.expr;
  }
  return '';
}
