import { ValidateResult } from 'react-hook-form';

import { DataFrame, ThresholdsConfig, ThresholdsMode } from '@grafana/data';
import { isTimeSeries } from '@grafana/data/src/dataframe/utils';
import { GraphTresholdsStyleMode } from '@grafana/schema';
import { config } from 'app/core/config';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ClassicCondition, ExpressionQueryType } from 'app/features/expressions/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { createDagFromQueries, getOriginOfRefId } from './dag';

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
    const isThresholdExpression = query.model.type === 'threshold';

    if (isMathExpression) {
      return {
        ...query,
        model: {
          ...query.model,
          expression: updateMathExpressionRefs(query.model.expression ?? '', previousRefId, newRefId),
        },
      };
    }

    if (isResampleExpression || isReduceExpression || isThresholdExpression) {
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

export type ThresholdDefinitions = Record<
  string,
  {
    config: ThresholdsConfig;
    mode: GraphTresholdsStyleMode;
  }
>;

/**
 * This function will retrieve threshold definitions for the given array of data and expression queries.
 */
export function getThresholdsForQueries(queries: AlertQuery[]) {
  const thresholds: ThresholdDefinitions = {};
  const SUPPORTED_EXPRESSION_TYPES = [ExpressionQueryType.threshold, ExpressionQueryType.classic];

  for (const query of queries) {
    if (!isExpressionQuery(query.model)) {
      continue;
    }

    // currently only supporting "threshold" & "classic_condition" expressions
    if (!SUPPORTED_EXPRESSION_TYPES.includes(query.model.type)) {
      continue;
    }

    if (!Array.isArray(query.model.conditions)) {
      continue;
    }

    // if any of the conditions are a "range" we switch to an "area" threshold view and ignore single threshold values
    // the time series panel does not support both.
    const hasRangeThreshold = query.model.conditions.some(isRangeCondition);

    query.model.conditions.forEach((condition, index) => {
      const threshold = condition.evaluator.params;

      // "classic_conditions" use `condition.query.params[]` and "threshold" uses `query.model.expression`
      const refId = condition.query.params[0] ?? query.model.expression;
      const isRangeThreshold = isRangeCondition(condition);

      try {
        // create a DAG so we can find the origin of the current expression
        const graph = createDagFromQueries(queries);

        const originRefIDs = getOriginOfRefId(refId, graph);
        const originQueries = queries.filter((query) => originRefIDs.includes(query.refId));

        originQueries.forEach((originQuery) => {
          const originRefID = originQuery.refId;

          // check if the origin is a data query
          const originIsDataQuery = !isExpressionQuery(originQuery?.model);

          // if yes, add threshold config to the refId of the data Query
          const hasValidOrigin = Boolean(originIsDataQuery && originRefID);

          // create the initial data structure for this origin refId
          if (originRefID && !thresholds[originRefID]) {
            thresholds[originRefID] = {
              config: {
                mode: ThresholdsMode.Absolute,
                steps: [],
              },
              mode: GraphTresholdsStyleMode.Line,
            };
          }

          if (originRefID && hasValidOrigin && !isRangeThreshold && !hasRangeThreshold) {
            appendSingleThreshold(originRefID, threshold[0]);
          } else if (originRefID && hasValidOrigin && isRangeThreshold) {
            appendRangeThreshold(originRefID, threshold, condition.evaluator.type);
            thresholds[originRefID].mode = GraphTresholdsStyleMode.LineAndArea;
          }
        });
      } catch (err) {
        console.error('Failed to parse thresholds', err);
        return;
      }
    });
  }

  function appendSingleThreshold(refId: string, value: number): void {
    thresholds[refId].config.steps.push(
      ...[
        {
          value: -Infinity,
          color: 'transparent',
        },
        {
          value: value,
          color: config.theme2.colors.error.main,
        },
      ]
    );
  }

  function appendRangeThreshold(refId: string, values: number[], type: EvalFunction): void {
    if (type === EvalFunction.IsWithinRange) {
      thresholds[refId].config.steps.push(
        ...[
          {
            value: -Infinity,
            color: 'transparent',
          },
          {
            value: values[0],
            color: config.theme2.colors.error.main,
          },
          {
            value: values[1],
            color: config.theme2.colors.error.main,
          },
          {
            value: values[1],
            color: 'transparent',
          },
        ]
      );
    }

    if (type === EvalFunction.IsOutsideRange) {
      thresholds[refId].config.steps.push(
        ...[
          {
            value: -Infinity,
            color: config.theme2.colors.error.main,
          },
          // we have to duplicate this value, or the graph will not display the handle in the right color
          {
            value: values[0],
            color: config.theme2.colors.error.main,
          },
          {
            value: values[0],
            color: 'transparent',
          },
          {
            value: values[1],
            color: config.theme2.colors.error.main,
          },
        ]
      );
    }

    // now also sort the threshold values, if we don't then they will look weird in the time series panel
    // TODO this doesn't work for negative values for now, those need to be sorted inverse
    thresholds[refId].config.steps.sort((a, b) => a.value - b.value);
  }

  return thresholds;
}

function isRangeCondition(condition: ClassicCondition) {
  return (
    condition.evaluator.type === EvalFunction.IsWithinRange || condition.evaluator.type === EvalFunction.IsOutsideRange
  );
}
