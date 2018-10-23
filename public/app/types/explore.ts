interface ExploreDatasource {
  value: string;
  label: string;
}

export interface Range {
  from: string;
  to: string;
}

export interface Query {
  query: string;
  key?: string;
}

export interface TextMatch {
  text: string;
  start: number;
  length: number;
  end: number;
}

export interface ExploreState {
  datasource: any;
  datasourceError: any;
  datasourceLoading: boolean | null;
  datasourceMissing: boolean;
  datasourceName?: string;
  exploreDatasources: ExploreDatasource[];
  graphResult: any;
  history: any[];
  latency: number;
  loading: any;
  logsResult: any;
  /**
   * Initial rows of queries to push down the tree.
   * Modifications do not end up here, but in `this.queryExpressions`.
   * The only way to reset a query is to change its `key`.
   */
  queries: Query[];
  /**
   * Errors caused by the running the query row.
   */
  queryErrors: any[];
  /**
   * Hints gathered for the query row.
   */
  queryHints: any[];
  range: Range;
  requestOptions: any;
  showingGraph: boolean;
  showingLogs: boolean;
  showingTable: boolean;
  supportsGraph: boolean | null;
  supportsLogs: boolean | null;
  supportsTable: boolean | null;
  tableResult: any;
}

export interface ExploreUrlState {
  datasource: string;
  queries: Query[];
  range: Range;
}
