import { DataSourceInstanceSettings, ScopedVars, TimeRange } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';
import { SqlDatasource } from 'app/features/plugins/sql/datasource/SqlDatasource';
import { CompletionItemKind, DB, LanguageCompletionProvider, SQLQuery } from 'app/features/plugins/sql/types';

import MySQLQueryModel from './MySqlQueryModel';
import { mapFieldsToTypes } from './fields';
import { buildColumnQuery, buildTableQuery, showDatabases } from './mySqlMetaQuery';
import { fetchColumns, fetchTables, getFunctions, getSqlCompletionProvider } from './sqlCompletionProvider';
import { MySQLOptions } from './types';

export class MySqlDatasource extends SqlDatasource {
  completionProvider: LanguageCompletionProvider | undefined;

  constructor(private instanceSettings: DataSourceInstanceSettings<MySQLOptions>) {
    super(instanceSettings);
    this.completionProvider = undefined;
  }

  getQueryModel(target?: Partial<SQLQuery>, templateSrv?: TemplateSrv, scopedVars?: ScopedVars): MySQLQueryModel {
    return new MySQLQueryModel(target!, templateSrv, scopedVars);
  }

  getSqlCompletionProvider(db: DB): LanguageCompletionProvider {
    if (this.completionProvider !== undefined) {
      return this.completionProvider;
    }

    const args = {
      getColumns: { current: (query: SQLQuery) => fetchColumns(db, query) },
      getTables: { current: (dataset?: string) => fetchTables(db, { dataset }) },
      fetchMeta: { current: (path?: string) => this.fetchMeta(path) },
      getFunctions: { current: () => getFunctions() },
    };
    this.completionProvider = getSqlCompletionProvider(args);
    return this.completionProvider;
  }

  async fetchDatasets(): Promise<string[]> {
    const datasets = await this.runSql<string[]>(showDatabases(), { refId: 'datasets' });
    return datasets.map((t) => t[0]);
  }

  async fetchTables(dataset?: string): Promise<string[]> {
    const tables = await this.runSql<string[]>(buildTableQuery(dataset), { refId: 'tables' });
    return tables.map((t) => t[0]);
  }

  async fetchFields(query: Partial<SQLQuery>) {
    if (!query.dataset || !query.table) {
      return [];
    }
    const queryString = buildColumnQuery(this.getQueryModel(query), query.table!);
    const frame = await this.runSql<string[]>(queryString, { refId: 'fields' });
    const fields = frame.map((f) => ({ name: f[0], text: f[0], value: f[0], type: f[1], label: f[0] }));
    return mapFieldsToTypes(fields);
  }

  async fetchMeta(path?: string) {
    const defaultDB = this.instanceSettings.jsonData.database;
    path = path?.trim();
    if (!path && defaultDB) {
      const tables = await this.fetchTables(defaultDB);
      return tables.map((t) => ({ name: t, completion: t, kind: CompletionItemKind.Class }));
    } else if (!path) {
      const datasets = await this.fetchDatasets();
      return datasets.map((d) => ({ name: d, completion: `${d}.`, kind: CompletionItemKind.Module }));
    } else {
      const parts = path.split('.').filter((s: string) => s);
      if (parts.length > 2) {
        return [];
      }
      if (parts.length === 1 && !defaultDB) {
        const tables = await this.fetchTables(parts[0]);
        return tables.map((t) => ({ name: t, completion: t, kind: CompletionItemKind.Class }));
      } else if (parts.length === 1 && defaultDB) {
        const fields = await this.fetchFields({ dataset: defaultDB, table: parts[0] });
        return fields.map((t) => ({ name: t.value, completion: t.value, kind: CompletionItemKind.Field }));
      } else if (parts.length === 2 && !defaultDB) {
        const fields = await this.fetchFields({ dataset: parts[0], table: parts[1] });
        return fields.map((t) => ({ name: t.value, completion: t.value, kind: CompletionItemKind.Field }));
      } else {
        return [];
      }
    }
  }

  getDB(): DB {
    if (this.db !== undefined) {
      return this.db;
    }
    return {
      datasets: () => this.fetchDatasets(),
      tables: (dataset?: string) => this.fetchTables(dataset),
      fields: (query: SQLQuery) => this.fetchFields(query),
      validateQuery: (query: SQLQuery, range?: TimeRange) =>
        Promise.resolve({ query, error: '', isError: false, isValid: true }),
      dsID: () => this.id,
      lookup: (path?: string) => this.fetchMeta(path),
      getSqlCompletionProvider: () => this.getSqlCompletionProvider(this.db),
      functions: async () => getFunctions(),
    };
  }
}
