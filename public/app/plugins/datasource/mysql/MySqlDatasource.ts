import { map as _map } from 'lodash';

import { DataSourceInstanceSettings, ScopedVars, TimeRange } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';
import MySQLQueryModel from 'app/plugins/datasource/mysql/MySqlQueryModel';

import { SqlDatasource } from '../sql/datasource/SqlDatasource';
import { DB, ResponseParser, SQLOptions, SQLQuery, TableSchema, ValidationResults } from '../sql/types';

import { buildColumnQuery, buildTableQuery, showDatabases } from './mySqlMetaQuery';
import MySqlResponseParser from './response_parser';

export class MySqlDatasource extends SqlDatasource {
  // queryModel: MySQLQueryModel;
  // metaBuilder: MysqlMetaQuery;

  constructor(instanceSettings: DataSourceInstanceSettings<SQLOptions>) {
    super(instanceSettings);
    // this.queryModel = new MySQLQueryModel(this.target, templateSrv, this.panel.scopedVars);
    // this.metaBuilder = new MysqlMetaQuery(this.target, this.queryModel);
  }

  getQueryModel(target?: SQLQuery, templateSrv?: TemplateSrv, scopedVars?: ScopedVars): MySQLQueryModel {
    return new MySQLQueryModel(target!, templateSrv, scopedVars);
  }

  getResponseParser(): ResponseParser {
    return new MySqlResponseParser();
  }

  async fetchDatasets(): Promise<string[]> {
    const datasets = await this.metricFindQuery(showDatabases(), {});
    return datasets.map((t) => t.text);
  }

  async fetchTables(dataset?: string): Promise<string[]> {
    const tables = await this.metricFindQuery(buildTableQuery(dataset), {});
    return tables.map((t) => t.text);
  }

  async fetchFields(query: SQLQuery) {
    const queryString = buildColumnQuery(this.getQueryModel(query), query.table!);
    const fields = await this.metricFindQuery(queryString, {});
    return fields.map((f) => f.text);
  }

  getDB(dsID?: string): DB {
    return {
      init: () => {
        return Promise.resolve();
      },
      datasets: () => this.fetchDatasets(),
      tables: (dataset?: string) => this.fetchTables(dataset),
      tableSchema: (query: SQLQuery | string) => {
        const schema = {} as TableSchema;
        return Promise.resolve(schema);
      },
      fields: (query: SQLQuery) => this.fetchFields(query),
      validateQuery: (query: SQLQuery, range?: TimeRange) => {
        const results = {} as ValidationResults;
        return Promise.resolve(results);
      },
      dsID: () => {
        return this.id;
      },
      dispose: (dsID?: string) => {},
      lookup: async (path?: string) => {
        if (!path) {
          const datasets = await this.fetchDatasets();
          return datasets.map((d) => ({ name: d, completion: `${d}.` }));
        } else {
          const parts = path.split('.').filter((s: string) => s);
          if (parts.length > 2) {
            return [];
          }
          if (parts.length === 1) {
            const tables = await this.fetchTables(path[0]);
            return tables.map((t) => ({ name: t, completion: `${t}\`` }));
          } else {
            return [];
          }
        }
      },
    };
  }
}
