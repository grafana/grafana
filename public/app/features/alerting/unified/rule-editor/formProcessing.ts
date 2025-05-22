import { isEmpty, omit } from 'lodash';

import { config } from '@grafana/runtime';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { isStrictReducer } from 'app/features/expressions/utils/expressionTypes';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { KVObject, RuleFormValues } from '../types/rule-form';
import { defaultAnnotations } from '../utils/constants';
import { isSupportedExternalRulesSourceType } from '../utils/datasource';
import { getInstantFromDataQuery } from '../utils/rule-form';

export function setQueryEditorSettings(values: RuleFormValues): RuleFormValues {
  const isQuerySwitchModeEnabled = config.featureToggles.alertingQueryAndExpressionsStepMode ?? false;

  if (!isQuerySwitchModeEnabled) {
    return {
      ...values,
      editorSettings: {
        simplifiedQueryEditor: false,
        simplifiedNotificationEditor: true, // actually it doesn't matter in this case
      },
    };
  }

  // data queries only
  const dataQueries = values.queries.filter((query) => !isExpressionQuery(query.model));

  // expression queries only
  const expressionQueries = values.queries.filter((query) => isExpressionQueryInAlert(query));

  const queryParamsAreTransformable = areQueriesTransformableToSimpleCondition(dataQueries, expressionQueries);
  return {
    ...values,
    editorSettings: {
      simplifiedQueryEditor: queryParamsAreTransformable,
      simplifiedNotificationEditor: true,
    },
  };
}

export function setInstantOrRange(values: RuleFormValues): RuleFormValues {
  return {
    ...values,
    queries: values.queries?.map((query) => {
      if (isExpressionQuery(query.model)) {
        return query;
      }
      // data query
      const defaultToInstant = query.model.datasource?.type
        ? isSupportedExternalRulesSourceType(query.model.datasource.type)
        : false;
      const isInstant =
        'instant' in query.model && query.model.instant !== undefined ? query.model.instant : defaultToInstant;
      return {
        ...query,
        model: {
          ...query.model,
          instant: isInstant,
          range: !isInstant, // we cannot have both instant and range queries in alerting
        },
      };
    }),
  };
}

/**
 * A alert rule is "transformable" to a simple condition editor if
 * 1. we have a single data query
 * 2. we have _either_
 *   2.1 a reduce expression (pointing to the data query) _and_ a threshold expression pointing to the reducer
 *   2.2 a threshold expression pointing to a (instant) data query
 * ⚠️ do not assert on refIds or indexes of the queries
 */
export function areQueriesTransformableToSimpleCondition(
  dataQueries: Array<AlertQuery<AlertDataQuery>>,
  expressionQueries: Array<AlertQuery<ExpressionQuery>>
) {
  // 1. check if we only have a _single_ data query
  if (dataQueries.length !== 1) {
    return false;
  }

  // short-circuit when we have more than 2 expressions, we don't know what to do with that
  if (expressionQueries.length > 2) {
    return false;
  }

  const dataQuery = dataQueries.at(0);

  // find the reduce or threshold expressions
  const reduceExpression = expressionQueries.find((query) => query.model.type === ExpressionQueryType.reduce);
  const thresholdExpression = expressionQueries.find((query) => query.model.type === ExpressionQueryType.threshold);

  // reducer should be set to "strict" mode
  const reducerIsStrict = reduceExpression ? isStrictReducer(reduceExpression.model) : false;
  // threshold expression shouldn't have an unload evaluator (custom recovery threshold)
  const thresholdExpressionIsClean =
    thresholdExpression?.model.conditions?.every((condition) => {
      return isEmpty(condition.unloadEvaluator);
    }) ?? true;

  const validReducerExpression = reduceExpression && reducerIsStrict;
  const validThresholdExpression = thresholdExpression && thresholdExpressionIsClean;

  const thresholdPointingToReducer = thresholdExpression?.model.expression === reduceExpression?.refId;
  const reducerPointingToDataQuery = reduceExpression?.model.expression === dataQuery?.refId;

  // 2.1 check for a reduce + threshold expression and their targets
  if (validReducerExpression && reducerPointingToDataQuery && validThresholdExpression && thresholdPointingToReducer) {
    return true;
  }

  // 2.2 check for a single threshold expression pointing to an "instant" data query
  const isInstantDataQuery = dataQuery ? getInstantFromDataQuery(dataQuery) : false;
  const hasSingleThresholdExpression = expressionQueries.length === 1 && thresholdExpression;
  const thresholdPointingToDataQuery = thresholdExpression?.model.expression === dataQuery?.refId;

  if (isInstantDataQuery && hasSingleThresholdExpression && validThresholdExpression && thresholdPointingToDataQuery) {
    return true;
  }

  return false;
}

export function isExpressionQueryInAlert(
  query: AlertQuery<AlertDataQuery | ExpressionQuery>
): query is AlertQuery<ExpressionQuery> {
  return isExpressionQuery(query.model);
}

export function isAlertQueryOfAlertData(
  query: AlertQuery<AlertDataQuery | ExpressionQuery>
): query is AlertQuery<AlertDataQuery> {
  return !isExpressionQuery(query.model);
}

// the backend will always execute "hidden" queries, so we have no choice but to remove the property in the front-end
// to avoid confusion. The query editor shows them as "disabled" and that's a different semantic meaning.
// furthermore the "AlertingQueryRunner" calls `filterQuery` on each data source and those will skip running queries that are "hidden"."
// It seems like we have no choice but to act like "hidden" queries don't exist in alerting.
export const revealHiddenQueries = (ruleDefinition: RuleFormValues): RuleFormValues => {
  return {
    ...ruleDefinition,
    queries: ruleDefinition.queries?.map((query) => omit(query, 'model.hide')),
  };
};

export function normalizeDefaultAnnotations(annotations: KVObject[]) {
  const orderedAnnotations = [...annotations];
  const defaultAnnotationKeys = defaultAnnotations.map((annotation) => annotation.key);

  defaultAnnotationKeys.forEach((defaultAnnotationKey, index) => {
    const fieldIndex = orderedAnnotations.findIndex((field) => field.key === defaultAnnotationKey);

    if (fieldIndex === -1) {
      //add the default annotation if abstent
      const emptyValue = { key: defaultAnnotationKey, value: '' };
      orderedAnnotations.splice(index, 0, emptyValue);
    } else if (fieldIndex !== index) {
      //move it to the correct position if present
      orderedAnnotations.splice(index, 0, orderedAnnotations.splice(fieldIndex, 1)[0]);
    }
  });
  return orderedAnnotations;
}
