import { DataSourceInstanceSettings, MetricFindValue } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import { DruidSettings, DruidQuery } from './types';

const druidVariableRegex = /\"\[\[(\w+)(?::druid:(\w+))?\]\]\"|\"\${(\w+)(?::druid:(\w+))?}\"/g;

export class DruidDataSource extends DataSourceWithBackend<DruidQuery, DruidSettings> {
  constructor(instanceSettings: DataSourceInstanceSettings<DruidSettings>) {
    super(instanceSettings);
  }
  filterQuery(query: DruidQuery) {
    return !query.hide;
  }
  applyTemplateVariables(templatedQuery: DruidQuery) {
    const templateSrv = getTemplateSrv();
    let template = JSON.stringify({ ...templatedQuery, expr: undefined }).replace(
      druidVariableRegex,
      (match, variable1, format1, variable2, format2) => {
        if (format1 || format2 === 'json') {
          return '${' + (variable1 || variable2) + ':doublequote}';
        }
        return match;
      }
    );
    return { ...JSON.parse(templateSrv.replace(template)), expr: templatedQuery.expr };
  }
  async metricFindQuery(query: DruidQuery, options?: any): Promise<MetricFindValue[]> {
    return this.postResource('query-variable', this.applyTemplateVariables(query)).then((response) => {
      return response;
    });
  }

  async getTagKeys(options?: any) {
    const columnNamesSql = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS"
    const tagKeysQuery = {
      "builder": {
        "queryType": "sql",
        "query": columnNamesSql,
      },
      "settings": {},
      "expr": "{\"builder\":{\"queryType\":\"sql\",\"query\":\""+columnNamesSql+"\",\"intervals\":{\"type\":\"intervals\",\"intervals\":[\"${__from:date:iso}/${__to:date:iso}\"]}},\"settings\":{}}"
    }

    return this.postResource('query-variable', this.applyTemplateVariables(tagKeysQuery as any));
  }

  async getTagValues(options: { key?: string } = {}) {
    const columnValuesSql = `SELECT ${options.key} FROM \"telemetry-dcde9fb7-6cec-4a4a-b015-114795a65ed0\" GROUP BY 1`;
    const tagValuesQuery = {
      "builder": {
        "queryType": "sql",
        "query": columnValuesSql,
      },
      "settings": {},
      "expr": "{\"builder\":{\"queryType\":\"sql\",\"query\":\""+columnValuesSql+"\",\"intervals\":{\"type\":\"intervals\",\"intervals\":[\"${__from:date:iso}/${__to:date:iso}\"]}},\"settings\":{}}"
    }
    return this.postResource('query-variable', this.applyTemplateVariables(tagValuesQuery as any));
  }
}
