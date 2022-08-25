import { DataSourceInstanceSettings, MetricFindValue } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';

import { DruidSettings, DruidQuery } from './types';

const druidVariableRegex = /\"\[\[(\w+)(?::druid:(\w+))?\]\]\"|\"\${(\w+)(?::druid:(\w+))?}\"/g;

interface AdHocFilterItem {
  key?: any;
  operator?: any;
  value?: any
}

export class DruidDataSource extends DataSourceWithBackend<DruidQuery, DruidSettings> {

  constructor(
    instanceSettings: DataSourceInstanceSettings<DruidSettings>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv(),
  ) {
    super(instanceSettings);
  }

  filterQuery(query: DruidQuery) {
    return !query.hide;
  }

  applyTemplateVariables(templatedQuery: DruidQuery) {
    const shouldEnhanceWithAdHocFilters = templatedQuery.datasource && templatedQuery.datasource.type === "grafadruid-druid-datasource";
    let template = JSON.stringify({...templatedQuery, expr: undefined});

    if (shouldEnhanceWithAdHocFilters) {
      template = this.enhanceExprWithAdHocFilters(template);
    }

    template = template.replace(
      druidVariableRegex,
      (match, variable1, format1, variable2, format2) => {
        if (format1 || format2 === 'json') {
          return '${' + (variable1 || variable2) + ':doublequote}';
        }
        return match;
      }
    );

    let expr = templatedQuery.expr;
    if (shouldEnhanceWithAdHocFilters) {
      expr = this.enhanceExprWithAdHocFilters(expr);
    }

    return {...JSON.parse(this.templateSrv.replace(template)), expr};
  }

  enhanceExprWithAdHocFilters(expr: string) {
    const adhocFilters = this.templateSrv.getAdhocFilters(this.name);

    const exprParsed = JSON.parse(expr);

    const filterMap: Record<string, AdHocFilterItem[]> = adhocFilters.reduce((acc: any, filter: AdHocFilterItem) => {
      const uniqueKey = `${filter.key}-${filter.operator}`;
      if (!acc[uniqueKey]) {
        acc[uniqueKey] = [filter];
      } else {
        acc[uniqueKey].push(filter);
      }
      return acc;
    }, {} as Record<string, AdHocFilterItem[]>)

    const filterFields = Object.values(filterMap).map((filters: AdHocFilterItem[]) => {
      if (filters.length === 1) {
        return {
          dimension: filters[0].key,
          type: "selector",
          value: filters[0].value,
        }
      } else {
        return {
          dimension: filters[0].key,
          type: "in",
          values: filters.map(filter => filter.value),
        }
      }
    })
    if (exprParsed.builder && exprParsed.builder.filter) {
      if (exprParsed.builder.filter.type === "and") {
        exprParsed.builder.filter.fields = exprParsed.builder.filter.fields.concat(filterFields);
      }
    }

    return JSON.stringify(exprParsed);
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
      "expr": "{\"builder\":{\"queryType\":\"sql\",\"query\":\"" + columnNamesSql + "\",\"intervals\":{\"type\":\"intervals\",\"intervals\":[\"${__from:date:iso}/${__to:date:iso}\"]}},\"settings\":{}}"
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
      "expr": "{\"builder\":{\"queryType\":\"sql\",\"query\":\"" + columnValuesSql + "\",\"intervals\":{\"type\":\"intervals\",\"intervals\":[\"${__from:date:iso}/${__to:date:iso}\"]}},\"settings\":{}}"
    }
    return this.postResource('query-variable', this.applyTemplateVariables(tagValuesQuery as any));
  }
}
