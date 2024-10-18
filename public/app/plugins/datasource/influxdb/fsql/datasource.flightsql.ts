import { v4 as uuidv4 } from 'uuid';

import { DataSourceInstanceSettings, TimeRange } from '@grafana/data';
import { CompletionItemKind, LanguageDefinition, TableIdentifier } from '@grafana/experimental';
import { TemplateSrv, config, getTemplateSrv } from '@grafana/runtime';
import { COMMON_FNS, DB, FuncParameter, SQLQuery, SqlDatasource, formatSQL } from '@grafana/sql';

import { mapFieldsToTypes } from './fields';
import { buildColumnQuery, buildTableQuery } from './flightsqlMetaQuery';
import { getSqlCompletionProvider } from './sqlCompletionProvider';
import { quoteIdentifierIfNecessary, quoteLiteral, toRawSql } from './sqlUtil';
import { FlightSQLOptions } from './types';

export class FlightSQLDatasource extends SqlDatasource {
  sqlLanguageDefinition: LanguageDefinition | undefined;

  constructor(
    private instanceSettings: DataSourceInstanceSettings<FlightSQLOptions>,
    protected readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
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
      id: 'flightsql',
      completionProvider: getSqlCompletionProvider(args),
      formatter: formatSQL,
    };
    return this.sqlLanguageDefinition;
  }

  async fetchDatasets(): Promise<string[]> {
    return Promise.resolve(['iox']);
  }

  async fetchTables(dataset?: string): Promise<string[]> {
    const query = buildTableQuery(dataset);
    const tables = await this.runSql<string[]>(query, { refId: 'tables' });
    const tableNames = tables.map((t) => quoteIdentifierIfNecessary(t[0]));
    tableNames.unshift(...this.getTemplateVariables());
    return tableNames;
  }

  async fetchFields(query: Partial<SQLQuery>) {
    if (!query.dataset || !query.table) {
      return [];
    }
    const interpolatedTable = this.templateSrv.replace(query.table);
    const queryString = buildColumnQuery(interpolatedTable, query.dataset);
    const frame = await this.runSql<string[]>(queryString, { refId: `fields-${uuidv4}` });
    const fields = frame.map((f) => ({
      name: f[0],
      text: f[0],
      value: quoteIdentifierIfNecessary(f[0]),
      type: f[1],
      label: f[0],
    }));
    fields.unshift(
      ...this.getTemplateVariables().map((v) => ({
        name: v,
        text: v,
        value: quoteIdentifierIfNecessary(v),
        type: '',
        label: v,
      }))
    );
    return mapFieldsToTypes(fields);
  }

  getTemplateVariables() {
    return this.templateSrv.getVariables().map((v) => `$${v.name}`);
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
    if (config.featureToggles.sqlQuerybuilderFunctionParameters) {
      const columnParam: FuncParameter = {
        name: 'Column',
        required: true,
        options: (query) => this.fetchFields(query),
      };
      const intervalParam: FuncParameter = {
        name: 'Interval',
        required: true,
        options: () => {
          return Promise.resolve([{ label: '$__interval', value: '$__interval' }]);
        },
      };

      return [
        ...fns.map((fn) => ({ ...fn, parameters: [columnParam] })),
        {
          name: '$__timeGroup',
          description: 'Time grouping function',
          parameters: [columnParam, intervalParam],
        },
        {
          name: '$__timeGroupAlias',
          description: 'Time grouping function with time as alias',
          parameters: [columnParam, intervalParam],
        },
      ];
    } else {
      return fns;
    }
  };

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
      toRawSql,
      functions: () => this.getFunctions(),
      getEditorLanguageDefinition: () => this.getSqlLanguageDefinition(),
    };
  }
}
