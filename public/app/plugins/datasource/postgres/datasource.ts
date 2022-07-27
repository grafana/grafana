import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data';
import { AGGREGATE_FNS } from 'app/features/plugins/sql/constants';
import { SqlDatasource } from 'app/features/plugins/sql/datasource/SqlDatasource';
import { DB, LanguageCompletionProvider, SQLQuery, SQLSelectableValue } from 'app/features/plugins/sql/types';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { PostgresQueryModel } from './PostgresQueryModel';
import { getSchema, getTimescaleDBVersion, getVersion, showDatabases, showTables } from './postgresMetaQuery';
import { fetchColumns, fetchTables, getSqlCompletionProvider } from './sqlCompletionProvider';
import { getIcon, getRAQBType, toRawSql } from './sqlUtil';
import { PostgresOptions } from './types';

export class PostgresDatasource extends SqlDatasource {
  completionProvider: LanguageCompletionProvider | undefined = undefined;

  constructor(instanceSettings: DataSourceInstanceSettings<PostgresOptions>, templateSrv?: TemplateSrv) {
    super(instanceSettings, templateSrv);
  }

  getQueryModel(target?: SQLQuery, templateSrv?: TemplateSrv, scopedVars?: ScopedVars): PostgresQueryModel {
    return new PostgresQueryModel(target, templateSrv, scopedVars);
  }

  async getVersion(): Promise<string> {
    const value = await this.runSql<{ version: number }>(getVersion());
    const results = value.fields.version.values.toArray();
    return results[0].toString();
  }

  async getTimescaleDBVersion(): Promise<string | undefined> {
    const value = await this.runSql<{ extversion: string }>(getTimescaleDBVersion());
    const results = value.fields.extversion.values.toArray();
    return results[0];
  }

  async fetchDatasets(): Promise<string[]> {
    const datasets = await this.runSql<{ datname: string[] }>(showDatabases(), { refId: 'datasets' });
    return datasets.fields.datname.values.toArray().flat();
  }

  async fetchTables(): Promise<string[]> {
    const tables = await this.runSql<{ table_name: string[] }>(showTables(), { refId: 'tables' });
    return tables.fields.table_name.values.toArray().flat();
  }

  getSqlCompletionProvider(db: DB): LanguageCompletionProvider {
    if (this.completionProvider !== undefined) {
      return this.completionProvider;
    }

    const args = {
      getColumns: { current: (query: SQLQuery) => fetchColumns(db, query) },
      getTables: { current: () => fetchTables(db) },
      //TODO: Add aggregate functions
      getFunctions: { current: () => AGGREGATE_FNS },
    };
    this.completionProvider = getSqlCompletionProvider(args);
    return this.completionProvider;
  }

  async fetchFields(query: SQLQuery): Promise<SQLSelectableValue[]> {
    const schema = await this.runSql<{ column: string; type: string }>(getSchema(query.table), { refId: 'columns' });
    const result: SQLSelectableValue[] = [];
    for (let i = 0; i < schema.length; i++) {
      const column = schema.fields.column.values.get(i);
      const type = schema.fields.type.values.get(i);
      result.push({ label: column, value: column, type, icon: getIcon(type), raqbFieldType: getRAQBType(type) });
    }
    return result;
  }

  getDB(): DB {
    return {
      init: () => Promise.resolve(true),
      datasets: () => this.fetchDatasets(),
      tables: () => this.fetchTables(),
      getSqlCompletionProvider: () => this.getSqlCompletionProvider(this.db),
      fields: async (query: SQLQuery) => {
        if (!query?.dataset && !query?.table) {
          return [];
        }
        return this.fetchFields(query);
      },
      validateQuery: (query) =>
        Promise.resolve({ isError: false, isValid: true, query, error: '', rawSql: query.rawSql }),
      dsID: () => this.id,
      toRawSql,
      lookup: async () => {
        const tables = await this.fetchTables();
        return tables.map((t) => ({ name: t, completion: t }));
      },
      functions: async () => AGGREGATE_FNS,
    };
  }
}
