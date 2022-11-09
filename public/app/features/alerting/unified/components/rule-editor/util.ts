import { ValidateResult } from 'react-hook-form';

import { DataFrame } from '@grafana/data';
import { isTimeSeries } from '@grafana/data/src/dataframe/utils';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { AlertQuery } from 'app/types/unified-alerting-dto';

export function queriesWithUpdatedReferences(
  queries: AlertQuery[],
  previousRefId: string,
  newRefId: string
): AlertQuery[] {
  return queries.map((query) => {
    if (previousRefId === newRefId) {
      return query;
    }

    if (!isExpressionQuery(query.model)) {
      return query;
    }

    const isMathExpression = query.model.type === 'math';
    const isReduceExpression = query.model.type === 'reduce';
    const isResampleExpression = query.model.type === 'resample';
    const isClassicExpression = query.model.type === 'classic_conditions';

    if (isMathExpression) {
      return {
        ...query,
        model: {
          ...query.model,
          expression: updateMathExpressionRefs(query.model.expression ?? '', previousRefId, newRefId),
        },
      };
    }

    if (isResampleExpression || isReduceExpression) {
      const isReferencing = query.model.expression === previousRefId;

      return {
        ...query,
        model: {
          ...query.model,
          expression: isReferencing ? newRefId : query.model.expression,
        },
      };
    }

    if (isClassicExpression) {
      const conditions = query.model.conditions?.map((condition) => ({
        ...condition,
        query: {
          ...condition.query,
          params: condition.query.params.map((param: string) => (param === previousRefId ? newRefId : param)),
        },
      }));

      return { ...query, model: { ...query.model, conditions } };
    }

    return query;
  });
}

export function updateMathExpressionRefs(expression: string, previousRefId: string, newRefId: string): string {
  const oldExpression = new RegExp('(\\$' + previousRefId + '\\b)|(\\${' + previousRefId + '})', 'gm');
  const newExpression = '${' + newRefId + '}';

  return expression.replace(oldExpression, newExpression);
}

export function refIdExists(queries: AlertQuery[], refId: string | null): boolean {
  return queries.find((query) => query.refId === refId) !== undefined;
}

// some gateways (like Istio) will decode "/" and "\" characters – this will cause 404 errors for any API call
// that includes these values in the URL (ie. /my/path%2fto/resource -> /my/path/to/resource)
//
// see https://istio.io/latest/docs/ops/best-practices/security/#customize-your-system-on-path-normalization
export function checkForPathSeparator(value: string): ValidateResult {
  const containsPathSeparator = value.includes('/') || value.includes('\\');
  if (containsPathSeparator) {
    return 'Cannot contain "/" or "\\" characters';
  }

  return true;
}

export function errorFromSeries(series: DataFrame[]): Error | undefined {
  if (series.length === 0) {
    return;
  }

  const isTimeSeriesResults = isTimeSeries(series);

  let error;
  if (isTimeSeriesResults) {
    error = new Error('You cannot use time series data as an alert condition, consider adding a reduce expression.');
  }

  return error;
}

export function warningFromSeries(series: DataFrame[]): Error | undefined {
  const notices = series[0]?.meta?.notices ?? [];
  const warning = notices.find((notice) => notice.severity === 'warning')?.text;

  return warning ? new Error(warning) : undefined;
}
