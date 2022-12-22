import { DataSourceInstanceSettings, ScopedVars, TimeRange } from '@grafana/data';
import { CompletionItemKind, LanguageDefinition, TableIdentifier } from '@grafana/experimental';
import { TemplateSrv } from '@grafana/runtime';
import { SqlDatasource } from 'app/features/plugins/sql/datasource/SqlDatasource';
import { DB, SQLQuery } from 'app/features/plugins/sql/types';
import { formatSQL } from 'app/features/plugins/sql/utils/formatSQL';

import MySQLQueryModel from './MySqlQueryModel';
import { mapFieldsToTypes } from './fields';
import { buildColumnQuery, buildTableQuery, showDatabases } from './mySqlMetaQuery';
import { getSqlCompletionProvider } from './sqlCompletionProvider';
import { MySQLOptions } from './types';

export class MySqlDatasource extends SqlDatasource {
  sqlLanguageDefinition: LanguageDefinition | undefined;

  constructor(private instanceSettings: DataSourceInstanceSettings<MySQLOptions>) {
    super(instanceSettings);
  }

  getQueryModel(target?: Partial<SQLQuery>, templateSrv?: TemplateSrv, scopedVars?: ScopedVars): MySQLQueryModel {
    return new MySQLQueryModel(target!, templateSrv, scopedVars);
  }

  getSqlLanguageDefinition(db: DB): LanguageDefinition {
    if (this.sqlLanguageDefinition !== undefined) {
      return this.sqlLanguageDefinition;
    }

    const args = {
      getMeta: { current: (identifier?: TableIdentifier) => this.fetchMeta(identifier) },
    };
    this.sqlLanguageDefinition = {
      id: 'sql',
      completionProvider: getSqlCompletionProvider(args),
      formatter: formatSQL,
    };
    return this.sqlLanguageDefinition;
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

  async fetchMeta(identifier?: TableIdentifier) {
    const defaultDB = this.instanceSettings.jsonData.database;
    if (!identifier?.schema && defaultDB) {
      const tables = await this.fetchTables(defaultDB);
      return tables.map((t) => ({ name: t, completion: `${defaultDB}.${t}`, kind: CompletionItemKind.Class }));
    } else if (!identifier?.schema && !defaultDB) {
      const datasets = await this.fetchDatasets();
      return datasets.map((d) => ({ name: d, completion: `${d}.`, kind: CompletionItemKind.Module }));
    } else {
      if (!identifier?.table && !defaultDB) {
        const tables = await this.fetchTables(identifier?.schema);
        return tables.map((t) => ({ name: t, completion: t, kind: CompletionItemKind.Class }));
      } else if (identifier?.table && identifier.schema) {
        const fields = await this.fetchFields({ dataset: identifier.schema, table: identifier.table });
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
      functions: () => ['VARIANCE', 'STDDEV'],
      getEditorLanguageDefinition: () => this.getSqlLanguageDefinition(this.db),
    };
  }
}
