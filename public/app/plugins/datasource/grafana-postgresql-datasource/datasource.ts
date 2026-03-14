import { v4 as uuidv4 } from 'uuid';

import { DataSourceInstanceSettings, ScopedVars, VariableWithMultiSupport } from '@grafana/data';
import { LanguageDefinition } from '@grafana/plugin-ui';
import { TemplateSrv } from '@grafana/runtime';
import { isSceneObject } from '@grafana/scenes';
import {
  COMMON_FNS,
  DB,
  formatSQL,
  FuncParameter,
  MACRO_FUNCTIONS,
  SqlDatasource,
  SQLQuery,
  SQLSelectableValue,
  SQLVariableSupport,
} from '@grafana/sql';

import { PostgresQueryModel } from './PostgresQueryModel';
import { migrateInterpolation } from './migration';
import { getSchema, getTimescaleDBVersion, getVersion, showTables } from './postgresMetaQuery';
import { fetchColumns, fetchTables, getSqlCompletionProvider } from './sqlCompletionProvider';
import { getFieldConfig, toRawSql } from './sqlUtil';
import { PostgresOptions } from './types';

export class PostgresDatasource extends SqlDatasource {
  sqlLanguageDefinition: LanguageDefinition | undefined = undefined;
  private _currentRawSql?: string;
  private _currentSceneObj?: import('@grafana/scenes').SceneObject;

  constructor(instanceSettings: DataSourceInstanceSettings<PostgresOptions>) {
    super(instanceSettings);
    this.dialect = 'postgres';
    this.variables = new SQLVariableSupport(this);
  }

  getQueryModel(target?: SQLQuery, templateSrv?: TemplateSrv, scopedVars?: ScopedVars): PostgresQueryModel {
    return new PostgresQueryModel(target, templateSrv, scopedVars);
  }

  // Strips redundant quotes from interpolated values on repeated panels
  // where the raw SQL already wraps the variable reference in quotes.
  protected migrateInterpolatedVariable(result: string | number, variable: VariableWithMultiSupport): string | number {
    return migrateInterpolation(result, variable.name, this._currentRawSql, this._currentSceneObj);
  }

  applyTemplateVariables(target: SQLQuery, scopedVars: ScopedVars) {
    const sceneScopedVar = scopedVars?.__sceneObject;
    const sceneValue = sceneScopedVar?.value.valueOf();

    this._currentRawSql = target.rawSql;
    this._currentSceneObj = sceneValue && isSceneObject(sceneValue) ? sceneValue : undefined;

    const rawSql = this.templateSrv.replace(target.rawSql, scopedVars, this.interpolateVariable);

    this._currentRawSql = undefined;
    this._currentSceneObj = undefined;

    return {
      refId: target.refId,
      datasource: this.getRef(),
      rawSql,
      format: target.format,
    };
  }

  async getVersion(): Promise<string> {
    const value = await this.runSql<{ version: number }>(getVersion());
    const results = value.fields.version?.values;

    if (!results) {
      return '';
    }

    return results[0].toString();
  }

  async getTimescaleDBVersion(): Promise<string | undefined> {
    const value = await this.runSql<{ extversion: string }>(getTimescaleDBVersion());
    const results = value.fields.extversion?.values;

    if (!results) {
      return undefined;
    }

    return results[0];
  }

  async fetchTables(): Promise<string[]> {
    const tables = await this.runSql<{ table: string[] }>(showTables(), { refId: 'tables' });
    return tables.fields.table?.values.flat() ?? [];
  }

  getSqlLanguageDefinition(db: DB): LanguageDefinition {
    if (this.sqlLanguageDefinition !== undefined) {
      return this.sqlLanguageDefinition;
    }

    const args = {
      getColumns: { current: (query: SQLQuery) => fetchColumns(db, query) },
      getTables: { current: () => fetchTables(db) },
    };
    this.sqlLanguageDefinition = {
      id: 'pgsql',
      completionProvider: getSqlCompletionProvider(args),
      formatter: formatSQL,
    };
    return this.sqlLanguageDefinition;
  }

  async fetchFields(query: SQLQuery): Promise<SQLSelectableValue[]> {
    const { table } = query;
    if (table === undefined) {
      // if no table-name, we are not able to query for fields
      return [];
    }
    const schema = await this.runSql<{ column: string; type: string }>(getSchema(table), {
      refId: `columns-${uuidv4()}`,
    });
    const result: SQLSelectableValue[] = [];
    for (let i = 0; i < schema.length; i++) {
      const column = schema.fields.column.values[i];
      const type = schema.fields.type.values[i];
      result.push({ label: column, value: column, type, ...getFieldConfig(type) });
    }
    return result;
  }

  getFunctions = (): ReturnType<DB['functions']> => {
    const columnParam: FuncParameter = {
      name: 'Column',
      required: true,
      options: (query) => this.fetchFields(query),
    };

    return [...MACRO_FUNCTIONS(columnParam), ...COMMON_FNS.map((fn) => ({ ...fn, parameters: [columnParam] }))];
  };

  getDB(): DB {
    if (this.db !== undefined) {
      return this.db;
    }

    return {
      init: () => Promise.resolve(true),
      datasets: () => Promise.resolve([]),
      tables: () => this.fetchTables(),
      getEditorLanguageDefinition: () => this.getSqlLanguageDefinition(this.db),
      fields: async (query: SQLQuery) => {
        if (!query?.table) {
          return [];
        }
        return this.fetchFields(query);
      },
      validateQuery: (query) =>
        Promise.resolve({ isError: false, isValid: true, query, error: '', rawSql: query.rawSql }),
      toRawSql,
      functions: () => this.getFunctions(),
      lookup: async () => {
        const tables = await this.fetchTables();
        return tables.map((t) => ({ name: t, completion: t }));
      },
    };
  }
}
