// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/migrations/variableMigration.ts
import { promQueryModeller } from '../querybuilder/PromQueryModeller';
import { buildVisualQueryFromString } from '../querybuilder/parsing';
import { PromVariableQuery, PromVariableQueryType as QueryType } from '../types';

export const PrometheusLabelNamesRegex = /^label_names\(\)\s*$/;
export const PrometheusLabelValuesRegex = /^label_values\((?:(.+),\s*)?(.+)\)\s*$/;
export const PrometheusMetricNamesRegex = /^metrics\((.+)\)\s*$/;
export const PrometheusQueryResultRegex = /^query_result\((.+)\)\s*$/;
export const PrometheusLabelNamesRegexWithMatch = /^label_names\((.+)\)\s*$/;

export function migrateVariableQueryToEditor(rawQuery: string | PromVariableQuery): PromVariableQuery {
  // If not string, we assume PromVariableQuery
  if (typeof rawQuery !== 'string') {
    return rawQuery;
  }

  const queryBase = {
    refId: 'PrometheusDatasource-VariableQuery',
    qryType: QueryType.LabelNames,
  };

  const labelNamesMatchQuery = rawQuery.match(PrometheusLabelNamesRegexWithMatch);

  if (labelNamesMatchQuery) {
    return {
      ...queryBase,
      qryType: QueryType.LabelNames,
      match: labelNamesMatchQuery[1],
    };
  }

  const labelNames = rawQuery.match(PrometheusLabelNamesRegex);
  if (labelNames) {
    return {
      ...queryBase,
      qryType: QueryType.LabelNames,
    };
  }

  const labelValuesCheck = rawQuery.match(/^label_values\(/);
  if (labelValuesCheck) {
    const labelValues = rawQuery.match(PrometheusLabelValuesRegex);
    const label = labelValues ? labelValues[2] : '';
    const metric = labelValues ? labelValues[1] : '';

    if (metric) {
      const visQuery = buildVisualQueryFromString(metric);
      return {
        ...queryBase,
        qryType: QueryType.LabelValues,
        label,
        metric: visQuery.query.metric,
        labelFilters: visQuery.query.labels,
      };
    } else {
      return {
        ...queryBase,
        qryType: QueryType.LabelValues,
        label,
      };
    }
  }

  const metricNamesCheck = rawQuery.match(/^metrics\(/);
  if (metricNamesCheck) {
    const metricNames = rawQuery.match(PrometheusMetricNamesRegex);
    const metric = metricNames ? metricNames[1] : '';
    return {
      ...queryBase,
      qryType: QueryType.MetricNames,
      metric,
    };
  }

  const queryResultCheck = rawQuery.match(/^query_result\(/);
  if (queryResultCheck) {
    const queryResult = rawQuery.match(PrometheusQueryResultRegex);
    const varQuery = queryResult ? queryResult[1] : '';
    return {
      ...queryBase,
      qryType: QueryType.VarQueryResult,
      varQuery,
    };
  }

  // seriesQuery does not have a function and no regex above
  if (!labelNames && !labelValuesCheck && !metricNamesCheck && !queryResultCheck) {
    return {
      ...queryBase,
      qryType: QueryType.SeriesQuery,
      seriesQuery: rawQuery,
    };
  }

  return queryBase;
}

// migrate it back to a string with the correct variables in place
export function migrateVariableEditorBackToVariableSupport(QueryVariable: PromVariableQuery): string {
  switch (QueryVariable.qryType) {
    case QueryType.LabelNames:
      if (QueryVariable.match) {
        return `label_names(${QueryVariable.match})`;
      }
      return 'label_names()';
    case QueryType.LabelValues:
      if (QueryVariable.metric || (QueryVariable.labelFilters && QueryVariable.labelFilters.length !== 0)) {
        const visualQueryQuery = {
          metric: QueryVariable.metric,
          labels: QueryVariable.labelFilters ?? [],
          operations: [],
        };

        const metric = promQueryModeller.renderQuery(visualQueryQuery);
        return `label_values(${metric},${QueryVariable.label})`;
      } else {
        return `label_values(${QueryVariable.label})`;
      }
    case QueryType.MetricNames:
      return `metrics(${QueryVariable.metric})`;
    case QueryType.VarQueryResult:
      const varQuery = removeLineBreaks(QueryVariable.varQuery);
      return `query_result(${varQuery})`;
    case QueryType.SeriesQuery:
      return QueryVariable.seriesQuery ?? '';
    case QueryType.ClassicQuery:
      return QueryVariable.classicQuery ?? '';
  }

  return '';
}

// allow line breaks in query result textarea
function removeLineBreaks(input?: string) {
  return input ? input.replace(/[\r\n]+/gm, '') : '';
}
