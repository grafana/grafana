interface ExploreDatasource {
  value: string;
  label: string;
}

export interface HistoryItem {
  ts: number;
  query: string;
}

export interface Range {
  from: string;
  to: string;
}

export interface Query {
  query: string;
  key?: string;
}

export interface QueryTransaction {
  id: string;
  done: boolean;
  error?: string;
  hints?: any[];
  latency: number;
  options: any;
  query: string;
  result?: any; // Table model / Timeseries[] / Logs
  resultType: ResultType;
  rowIndex: number;
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
  graphRange: Range;
  history: HistoryItem[];
  /**
   * Initial rows of queries to push down the tree.
   * Modifications do not end up here, but in `this.queryExpressions`.
   * The only way to reset a query is to change its `key`.
   */
  queries: Query[];
  /**
   * Hints gathered for the query row.
   */
  queryTransactions: QueryTransaction[];
  range: Range;
  showingGraph: boolean;
  showingLogs: boolean;
  showingTable: boolean;
  supportsGraph: boolean | null;
  supportsLogs: boolean | null;
  supportsTable: boolean | null;
}

export interface ExploreUrlState {
  datasource: string;
  queries: Query[];
  range: Range;
}

export type ResultType = 'Graph' | 'Logs' | 'Table';
