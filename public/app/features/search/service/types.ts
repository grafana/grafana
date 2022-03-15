export interface QueryResults {
  match: QueryResult[];
}

export interface QueryResult {
  kind: string; // panel, dashboard, folder
  name: string;
  description?: string;
  url: string; // link to value (unique)
  tags?: string[];
  location?: string; // the folder name
  score?: number;
}

export interface QueryFilters {
  kind?: string; // limit to a single type
  tags?: string[]; // match all tags
}

export interface GrafanaSearcher {
  search: (query: string, filter?: QueryFilters) => Promise<QueryResults>;
}
