import { v4 as uuidv4 } from 'uuid';

import { DataSourceInstanceSettings, TimeRange } from '@grafana/data';
import { CompletionItemKind, LanguageDefinition, TableIdentifier } from '@grafana/plugin-ui';
import { COMMON_FNS, DB, FuncParameter, MACRO_FUNCTIONS, SQLQuery, SqlDatasource, formatSQL } from '@grafana/sql';

import { mapFieldsToTypes } from './fields';
import { buildColumnQuery, buildTableQuery, showDatabases } from './mySqlMetaQuery';
import { getSqlCompletionProvider } from './sqlCompletionProvider';
import { quoteIdentifierIfNecessary, quoteLiteral, toRawSql } from './sqlUtil';
import { MySQLOptions } from './types';

export class MySqlDatasource extends SqlDatasource {
  sqlLanguageDefinition: LanguageDefinition | undefined;

  constructor(private instanceSettings: DataSourceInstanceSettings<MySQLOptions>) {
    super(instanceSettings);
  }

  getQueryModel() {
    return { quoteLiteral };
  }

  getSqlLanguageDefinition(): LanguageDefinition {
    if (this.sqlLanguageDefinition !== undefined) {
      return this.sqlLanguageDefinition;
    }

    const args = {
      getMeta: (identifier?: TableIdentifier) => this.fetchMeta(identifier),
    };

    this.sqlLanguageDefinition = {
      id: 'mysql',
      completionProvider: getSqlCompletionProvider(args),
      formatter: formatSQL,
    };

    return this.sqlLanguageDefinition;
  }

  async fetchDatasets(): Promise<string[]> {
    const datasets = await this.runSql<string[]>(showDatabases(), { refId: 'datasets' });
    return datasets.map((t) => quoteIdentifierIfNecessary(t[0]));
  }

  async fetchTables(dataset?: string): Promise<string[]> {
    const tables = await this.runSql<string[]>(buildTableQuery(dataset), { refId: 'tables' });
    return tables.map((t) => quoteIdentifierIfNecessary(t[0]));
  }

  async fetchFields(query: Partial<SQLQuery>) {
    if (!query.dataset || !query.table) {
      return [];
    }
    const queryString = buildColumnQuery(query.table, query.dataset);
    const frame = await this.runSql<string[]>(queryString, { refId: `fields-${uuidv4()}` });
    const fields = frame.map((f) => ({
      name: f[0],
      text: f[0],
      value: quoteIdentifierIfNecessary(f[0]),
      type: f[1],
      label: f[0],
    }));
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
      if (!identifier?.table && (!defaultDB || identifier?.schema)) {
        const tables = await this.fetchTables(identifier?.schema);
        return tables.map((t) => ({ name: t, completion: t, kind: CompletionItemKind.Class }));
      } else if (identifier?.table && identifier.schema) {
        const fields = await this.fetchFields({ dataset: identifier.schema, table: identifier.table });
        return fields.map((t) => ({ name: t.name, completion: t.value, kind: CompletionItemKind.Field }));
      } else {
        return [];
      }
    }
  }

  getFunctions = (): ReturnType<DB['functions']> => {
    const fns = [...COMMON_FNS, { name: 'VARIANCE' }, { name: 'STDDEV' }];

    const columnParam: FuncParameter = {
      name: 'Column',
      required: true,
      options: (query) => this.fetchFields(query),
    };

    return [...MACRO_FUNCTIONS(columnParam), ...fns.map((fn) => ({ ...fn, parameters: [columnParam] }))];
  };

  getDB(): DB {
    if (this.db !== undefined) {
      return this.db;
    }

    return {
      datasets: () => this.fetchDatasets(),
      tables: (dataset?: string) => this.fetchTables(dataset),
      fields: (query: SQLQuery) => this.fetchFields(query),
      validateQuery: (query: SQLQuery, _range?: TimeRange) =>
        Promise.resolve({ query, error: '', isError: false, isValid: true }),
      dsID: () => this.id,
      toRawSql,
      functions: () => this.getFunctions(),
      getEditorLanguageDefinition: () => this.getSqlLanguageDefinition(),
    };
  }
}
