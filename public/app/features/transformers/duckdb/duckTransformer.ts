// import { compile } from "prql-js/dist/bundler";
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
    // const sql2 = compile(`from employees | select first_name`);
    // console.log(sql2);

    let sql = options.query;
    if (!sql?.length) {
      sql = `SELECT * FROM generate_series(1, 20, 2) t(v)`;
    }

    const subj = new Subject<DataFrame[]>();

    // ??? need an unsubscribe!!!
    source.subscribe(async (data) => {
      const db = await getDuckDB();
      const conn = await db.connect();

      try {
        for await (const frame of data) {
          const data: Record<string, unknown[]> = {};

          frame.fields.forEach(field => {
            data[field.name] = field.values;
          });

          let tableName = frame.refId ?? 'A';

          await db.registerFileText(`${tableName}.json`, JSON.stringify(data));
          await conn.insertJSONFromPath(`${tableName}.json`, { name: tableName });
        }

        const result = await conn.query(sql);
        const df = arrowTableToFrame(result);
        subj.next([df]);

        for await (const frame of data) {
          let tableName = frame.refId ?? 'A';

          // hmm, this doesnt work and we're stuck with DuckDB singleton?
          // do we re-create the db on each transfomer invoke?
          // or truncate all existing tables?
          await conn.query(`DROP TABLE IF EXISTS ${tableName}`);
        }

        await db.flushFiles();
        await db.dropFiles();
        await conn.close();
      } catch (err) {
        subj.error(err); // tell the parent
      }
      await conn.close();
    });

    return subj;
  },
};
