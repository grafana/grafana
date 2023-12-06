import { map } from 'rxjs';

import { DataTransformerID, DataTransformerInfo } from '@grafana/data';

export enum QueryType {
  prql = 'prql',
  sql = 'sql',
}

export interface DuckTransformerOptions {
  type: QueryType;
  query: string;
}

export const DuckDBTransformer: DataTransformerInfo<DuckTransformerOptions> = {
  id: DataTransformerID.duckdb,
  name: 'DuckDB query',
  operator: (options) => (source) => {
    const sql = options.query;
    console.log('TODO QUERY:', sql);

    return source.pipe(map((data) => data));
  },
};
