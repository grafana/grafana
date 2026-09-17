import { xor } from 'lodash';

import {
  type DataFrame,
  LoadingState,
  type PanelData,
  type ThresholdsConfig,
  ThresholdsMode,
  isTimeSeriesFrames,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { GraphThresholdsStyleMode } from '@grafana/schema';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { isClassicExpression, isThresholdExpression } from 'app/features/expressions/schemas/expressionQuery';
import { ExpressionQueryType } from 'app/features/expressions/types';
import { isRangeEvaluator } from 'app/features/expressions/utils/expressionTypes';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

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

    const model = query.model;

    switch (model.type) {
      case ExpressionQueryType.math:
        return {
          ...query,
          model: {
            ...model,
            expression: updateMathExpressionRefs(model.expression, previousRefId, newRefId),
          },
        };

      case ExpressionQueryType.reduce:
      case ExpressionQueryType.resample:
      case ExpressionQueryType.threshold:
        return {
          ...query,
          model: {
            ...model,
            expression: model.expression === previousRefId ? newRefId : model.expression,
          },
        };

      case ExpressionQueryType.classic:
        return {
          ...query,
          model: {
            ...model,
            conditions: model.conditions.map((condition) => ({
              ...condition,
              query: {
                ...condition.query,
                params: condition.query.params.map((param) => (param === previousRefId ? newRefId : param)),
              },
            })),
          },
        };

      // SQL names its inputs inside the query text, which we do not rewrite.
      case ExpressionQueryType.sql:
        return query;
    }
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

export function containsPathSeparator(value: string): boolean {
  return value.includes('/') || value.includes('\\');
}

// this function assumes we've already checked if the data passed in to the function is of the alert condition
export function errorFromCurrentCondition(data: PanelData): Error | undefined {
  if (data.series.length === 0) {
    return;
  }

  const isTimeSeriesResults = isTimeSeriesFrames(data.series);

  let error;
  if (isTimeSeriesResults) {
    error = new Error('You cannot use time series data as an alert condition, consider adding a reduce expression.');
  }

  return error;
}

export function errorFromPreviewData(data: PanelData): Error | undefined {
  // give preference to QueryErrors
  if (data.errors?.length) {
    return new Error(data.errors[0].message);
  }

  return;
}

export function warningFromSeries(series: DataFrame[]): Error | undefined {
  const notices = series[0]?.meta?.notices ?? [];
  const warning = notices.find((notice) => notice.severity === 'warning')?.text;

  return warning ? new Error(warning) : undefined;
}

export type ThresholdDefinition = {
  config: ThresholdsConfig;
  mode: GraphThresholdsStyleMode;
};

export type ThresholdDefinitions = Record<string, ThresholdDefinition>;

/**
 * This function will retrieve threshold definitions for the given array of data and expression queries.
 */
export function getThresholdsForQueries(queries: AlertQuery[], condition: string | null) {
  const thresholds: ThresholdDefinitions = {};

  if (!condition) {
    return thresholds;
  }

  for (const query of queries) {
    if (!isExpressionQuery(query.model)) {
      continue;
    }

    const model = query.model;

    // currently only supporting "threshold" & "classic_condition" expressions
    if (!isThresholdExpression(model) && !isClassicExpression(model)) {
      continue;
    }

    if (model.refId !== condition) {
      continue;
    }

    // The two types name the query they read differently: a classic condition carries it per
    // condition, a threshold has one expression for the whole thing. Flatten both to the same
    // shape so the rest of this only has one case to handle.
    const conditions = isClassicExpression(model)
      ? model.conditions.map((condition) => ({
          evaluator: condition.evaluator,
          refId: condition.query.params[0],
        }))
      : model.conditions.map((condition) => ({
          evaluator: condition.evaluator,
          refId: model.expression,
        }));

    // if any of the conditions are a "range" we switch to an "area" threshold view and ignore single threshold values
    // the time series panel does not support both.
    const hasRangeThreshold = conditions.some(({ evaluator }) => isRangeEvaluator(evaluator.type));

    conditions.forEach(({ evaluator, refId }) => {
      const threshold = evaluator.params;

      // if an expression hasn't been linked to a data query yet, it won't have a refId
      if (!refId) {
        return;
      }

      const isRangeThreshold = isRangeEvaluator(evaluator.type);

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
              mode: GraphThresholdsStyleMode.Line,
            };
          }

          if (originRefID && hasValidOrigin && !isRangeThreshold && !hasRangeThreshold) {
            if (threshold?.[0] === undefined) {
              return;
            }
            appendSingleThreshold(originRefID, threshold[0]);
          } else if (originRefID && hasValidOrigin && isRangeThreshold) {
            if (!threshold) {
              return;
            }
            appendRangeThreshold(originRefID, threshold, evaluator.type);
            thresholds[originRefID].mode = GraphThresholdsStyleMode.LineAndArea;
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

    if (type === EvalFunction.IsWithinRangeIncluded) {
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

    if (type === EvalFunction.IsOutsideRangeIncluded) {
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

    // also make sure we remove any "undefined" values from our steps in case the threshold config is incomplete
    thresholds[refId].config.steps = thresholds[refId].config.steps.filter((step) => step.value !== undefined);
  }

  return thresholds;
}

export function getStatusMessage(data: PanelData): string | undefined {
  const genericErrorMessage = 'Failed to fetch data';
  if (data.state !== LoadingState.Error) {
    return;
  }

  const errors = data.errors;
  if (errors?.length) {
    return errors.map((error) => error.message ?? genericErrorMessage).join(', ');
  }

  return data.error?.message ?? genericErrorMessage;
}

/**
 * This function finds what refIds have been updated given the previous Array of queries and an Array of updated data queries.
 * All expression queries are discarded from the arrays, since we have separate handlers for those (see "onUpdateRefId") of the ExpressionEditor
 *
 * This code assumes not more than 1 query refId has changed per "onChangeQueries",
 */
export function findRenamedDataQueryReferences(
  previousQueries: AlertQuery[],
  updatedQueries: AlertQuery[]
): [string, string] {
  const updatedDataQueries = updatedQueries
    .filter((query) => !isExpressionQuery(query.model))
    .map((query) => query.refId);
  const previousDataQueries = previousQueries
    .filter((query) => !isExpressionQuery(query.model))
    .map((query) => query.refId);

  // given the following two arrays
  // ['A', 'B', 'C'] and ['FOO', 'B' 'C']
  // the "xor" function will return ['A', 'FOO'] because those are not in both arrays
  const [oldRefId, newRefId] = xor(previousDataQueries, updatedDataQueries);

  return [oldRefId, newRefId];
}
