export interface Range {
  from: string;
  to: string;
}

export interface Query {
  query: string;
  edited?: boolean;
  key?: string;
}

export interface ExploreState {
  datasource: any;
  datasourceError: any;
  datasourceLoading: boolean | null;
  datasourceMissing: boolean;
  datasourceName?: string;
  graphResult: any;
  history: any[];
  latency: number;
  loading: any;
  logsResult: any;
  queries: Query[];
  queryErrors: any[];
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
