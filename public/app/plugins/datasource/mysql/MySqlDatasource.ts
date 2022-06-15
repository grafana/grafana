import { map as _map } from 'lodash';

import { DataSourceInstanceSettings, ScopedVars, TimeRange } from '@grafana/data';
import { LanguageCompletionProvider } from '@grafana/experimental';
import { TemplateSrv } from '@grafana/runtime';
import MySQLQueryModel from 'app/plugins/datasource/mysql/MySqlQueryModel';

import { SqlDatasource } from '../sql/datasource/SqlDatasource';
import { DB, ResponseParser, SQLOptions, SQLQuery, ValidationResults } from '../sql/types';

import MySqlResponseParser from './MySqlResponseParser';
import { mapFieldsToTypes } from './fields';
import { buildColumnQuery, buildTableQuery, showDatabases } from './mySqlMetaQuery';
import { fetchColumns, fetchTables, getSqlCompletionProvider } from './sqlCompletionProvider';
import { MySQLQuery } from './types';

export class MySqlDatasource extends SqlDatasource {
  responseParser: MySqlResponseParser;
  completionProvider: LanguageCompletionProvider | undefined;

  constructor(private instanceSettings: DataSourceInstanceSettings<SQLOptions>) {
    super(instanceSettings);
    this.responseParser = new MySqlResponseParser();
    this.completionProvider = undefined;
  }

  getQueryModel(target?: SQLQuery, templateSrv?: TemplateSrv, scopedVars?: ScopedVars): MySQLQueryModel {
    return new MySQLQueryModel(target!, templateSrv, scopedVars);
  }

  getResponseParser(): ResponseParser {
    return this.responseParser;
  }

  getSqlCompletionProvider(db: DB): LanguageCompletionProvider {
    if (this.completionProvider !== undefined) {
      return this.completionProvider;
    }
    const args = {
      getColumns: { current: (query: MySQLQuery) => fetchColumns(db, query) },
      getTables: { current: (dataset?: string) => fetchTables(db, { dataset } as SQLQuery) },
      fetchMeta: { current: (path?: string) => this.fetchMeta(path) },
    };
    this.completionProvider = getSqlCompletionProvider(args);
    return this.completionProvider;
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
    if (!query.dataset || !query.table) {
      return [];
    }
    const queryString = buildColumnQuery(this.getQueryModel(query), query.table!);
    const frame = await this.runSql(queryString);
    const fields = frame.map((f) => ({ name: f[0], text: f[0], value: f[0], type: f[1], label: f[0] }));
    return mapFieldsToTypes(fields);
  }

  async fetchMeta(path?: string) {
    const defaultDB = this.instanceSettings.jsonData.database;
    path = path?.trim();
    if (!path && defaultDB) {
      const tables = await this.fetchTables(defaultDB);
      return tables.map((t) => ({ name: t, completion: t }));
    } else if (!path) {
      const datasets = await this.fetchDatasets();
      return datasets.map((d) => ({ name: d, completion: `${d}.` }));
    } else {
      const parts = path.split('.').filter((s: string) => s);
      if (parts.length > 2) {
        return [];
      }
      if (parts.length === 1) {
        const tables = await this.fetchTables(parts[0]);
        return tables.map((t) => ({ name: t, completion: t }));
      } else {
        return [];
      }
    }
  }

  getDB(dsID?: string): DB {
    if (this.db !== undefined) {
      return this.db;
    }
    return {
      init: () => Promise.resolve(true),
      datasets: () => this.fetchDatasets(),
      tables: (dataset?: string) => this.fetchTables(dataset),
      fields: (query: SQLQuery) => this.fetchFields(query),
      validateQuery: (query: SQLQuery, range?: TimeRange) => Promise.resolve({} as ValidationResults),
      dsID: () => this.id,
      dispose: (dsID?: string) => {},
      lookup: (path?: string) => this.fetchMeta(path),
      getSqlCompletionProvider: () => this.getSqlCompletionProvider(this.db),
    };
  }
}
