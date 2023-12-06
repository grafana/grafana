import { Subject } from 'rxjs';

import { DataTransformerID, DataTransformerInfo, DataFrame } from '@grafana/data';

import { arrowTableToFrame, getDuckDB } from './duck';

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
    let sql = options.query;
    if (!sql?.length) {
      sql = `SELECT * FROM generate_series(1, 20, 2) t(v)`;
    }

    const subj = new Subject<DataFrame[]>();

    // ??? need an unsubscribe!!!
    source.subscribe(async (data) => {
      const db = await getDuckDB();
      console.log('TODO: ', sql);

      // ... or column-major format
      const jsonColContent = {
        col1: [1, 2],
        col2: ['foo', 'bar'],
      };
      await db.registerFileText('columns.json', JSON.stringify(jsonColContent));
      const conn = await db.connect();

      try {
        // TODO!!! load the required data!
        const result = await conn.query(sql);
        const df = arrowTableToFrame(result);
        subj.next([df]);
      } catch (err) {
        subj.error(err); // tell the parent
      }
      await conn.close();
    });

    return subj;
  },
};
