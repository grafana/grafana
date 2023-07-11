import { promQueryModeller } from '../querybuilder/PromQueryModeller';
import { buildVisualQueryFromString } from '../querybuilder/parsing';
import { PromVariableQuery, PromVariableQueryType as QueryType } from '../types';

export const PrometheusLabelNamesRegex = /^label_names\(\)\s*$/;
// Note that this regex is different from the one in metric_find_query.ts because this is used pre-interpolation
export const PrometheusLabelValuesRegex = /^label_values\((?:(.+),\s*)?([a-zA-Z_$][a-zA-Z0-9_]*)\)\s*$/;
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

  const labelValues = rawQuery.match(PrometheusLabelValuesRegex);

  if (labelValues) {
    const label = labelValues[2];
    const metric = labelValues[1];

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

  const metricNames = rawQuery.match(PrometheusMetricNamesRegex);
  if (metricNames) {
    return {
      ...queryBase,
      qryType: QueryType.MetricNames,
      metric: metricNames[1],
    };
  }

  const queryResult = rawQuery.match(PrometheusQueryResultRegex);
  if (queryResult) {
    return {
      ...queryBase,
      qryType: QueryType.VarQueryResult,
      varQuery: queryResult[1],
    };
  }

  // seriesQuery does not have a function and no regex above
  if (!labelNames && !labelValues && !metricNames && !queryResult) {
    return {
      ...queryBase,
      qryType: QueryType.SeriesQuery,
      seriesQuery: rawQuery,
    };
  }

  return queryBase;
}

// migrate it back to a string with the correct varialbes in place
export function migrateVariableEditorBackToVariableSupport(QueryVariable: PromVariableQuery): string {
  switch (QueryVariable.qryType) {
    case QueryType.LabelNames:
      if (QueryVariable.match) {
        return `label_names(${QueryVariable.match})`;
      }
      return 'label_names()';
    case QueryType.LabelValues:
      if (QueryVariable.metric) {
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
      return '' + QueryVariable.seriesQuery;
  }

  return '';
}

// allow line breaks in query result textarea
function removeLineBreaks(input?: string) {
  return input ? input.replace(/[\r\n]+/gm, '') : '';
}
