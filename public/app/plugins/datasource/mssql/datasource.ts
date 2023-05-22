import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data';
import { LanguageDefinition } from '@grafana/experimental';
import { TemplateSrv } from '@grafana/runtime';
import { SqlDatasource } from 'app/features/plugins/sql/datasource/SqlDatasource';
import { DB, SQLQuery, SQLSelectableValue } from 'app/features/plugins/sql/types';
import { formatSQL } from 'app/features/plugins/sql/utils/formatSQL';

import { getSchema, showDatabases, getSchemaAndName } from './MSSqlMetaQuery';
import { MSSqlQueryModel } from './MSSqlQueryModel';
import { fetchColumns, fetchTables, getSqlCompletionProvider } from './sqlCompletionProvider';
import { getIcon, getRAQBType, toRawSql } from './sqlUtil';
import { MssqlOptions } from './types';

export class MssqlDatasource extends SqlDatasource {
  sqlLanguageDefinition: LanguageDefinition | undefined = undefined;
  constructor(instanceSettings: DataSourceInstanceSettings<MssqlOptions>) {
    super(instanceSettings);
  }

  getQueryModel(target?: SQLQuery, templateSrv?: TemplateSrv, scopedVars?: ScopedVars): MSSqlQueryModel {
    return new MSSqlQueryModel(target, templateSrv, scopedVars);
  }

  async fetchDatasets(): Promise<string[]> {
    const datasets = await this.runSql<{ name: string[] }>(showDatabases(), { refId: 'datasets' });
    return datasets.fields.name?.values.toArray().flat() ?? [];
  }

  async fetchTables(dataset?: string): Promise<string[]> {
    // We get back the table name with the schema as well. like dbo.table
    const tables = await this.runSql<{ schemaAndName: string[] }>(getSchemaAndName(dataset), { refId: 'tables' });
    return tables.fields.schemaAndName?.values.toArray().flat() ?? [];
  }

  async fetchFields(query: SQLQuery): Promise<SQLSelectableValue[]> {
    if (!query.table) {
      return [];
    }
    const [_, table] = query.table.split('.');
    const schema = await this.runSql<{ column: string; type: string }>(getSchema(query.dataset, table), {
      refId: 'columns',
    });
    const result: SQLSelectableValue[] = [];
    for (let i = 0; i < schema.length; i++) {
      const column = schema.fields.column.values.get(i);
      const type = schema.fields.type.values.get(i);
      result.push({ label: column, value: column, type, icon: getIcon(type), raqbFieldType: getRAQBType(type) });
    }
    return result;
  }

  getSqlLanguageDefinition(db: DB): LanguageDefinition {
    if (this.sqlLanguageDefinition !== undefined) {
      return this.sqlLanguageDefinition;
    }
    const args = {
      getColumns: { current: (query: SQLQuery) => fetchColumns(db, query) },
      getTables: { current: (dataset?: string) => fetchTables(db, dataset) },
    };
    this.sqlLanguageDefinition = {
      id: 'sql',
      completionProvider: getSqlCompletionProvider(args),
      formatter: formatSQL,
    };
    return this.sqlLanguageDefinition;
  }

  getDB(): DB {
    if (this.db !== undefined) {
      return this.db;
    }
    return {
      init: () => Promise.resolve(true),
      datasets: () => this.fetchDatasets(),
      tables: (dataset?: string) => this.fetchTables(dataset),
      getEditorLanguageDefinition: () => this.getSqlLanguageDefinition(this.db),
      fields: async (query: SQLQuery) => {
        if (!query?.dataset || !query?.table) {
          return [];
        }
        return this.fetchFields(query);
      },
      validateQuery: (query) =>
        Promise.resolve({ isError: false, isValid: true, query, error: '', rawSql: query.rawSql }),
      dsID: () => this.id,
      dispose: (dsID?: string) => {},
      toRawSql,
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
            const tables = await this.fetchTables(parts[0]);
            return tables.map((t) => ({ name: t, completion: t }));
          } else {
            return [];
          }
        }
      },
    };
  }
}
