import { isEmpty, omit } from 'lodash';

import { ReducerID, getNextRefId } from '@grafana/data';
import { config } from '@grafana/runtime';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionDatasourceUID, type ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { isStrictReducer } from 'app/features/expressions/utils/expressionTypes';
import { type AlertDataQuery, type AlertQuery } from 'app/types/unified-alerting-dto';

import { type KVObject, type RuleFormValues, type SimpleCondition } from '../types/rule-form';
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

  // expression queries only - but filter out invalid ones that don't have a type field
  const expressionQueries = values.queries.filter((query): query is AlertQuery<ExpressionQuery> => {
    if (!isExpressionQueryInAlert(query)) {
      return false;
    }
    // Some sources (e.g. dashboard panel, API) can yield expression-like queries without a type field
    return 'type' in query.model && query.model.type !== undefined;
  });

  // If we have data queries but no VALID expressions (e.g., coming from dashboard panel with malformed expressions),
  // remove the invalid expressions and set condition to empty so simplified mode can regenerate them
  const hasDataQueries = dataQueries.length > 0;
  const hasValidExpressions = expressionQueries.length > 0;
  const totalExpressions = values.queries.filter((query) => isExpressionQueryInAlert(query)).length;
  const hasInvalidExpressions = totalExpressions > expressionQueries.length;

  if (hasDataQueries && hasInvalidExpressions) {
    const validRefIds = new Set(expressionQueries.map((q) => q.refId));
    const conditionRefStillValid = values.condition && validRefIds.has(values.condition);
    const strippedQueries = [...dataQueries, ...expressionQueries];

    return {
      ...values,
      queries: strippedQueries,
      condition: conditionRefStillValid ? values.condition : (expressionQueries[0]?.refId ?? ''),
      editorSettings: {
        simplifiedQueryEditor: hasValidExpressions
          ? areQueriesTransformableToSimpleCondition(dataQueries, expressionQueries)
          : true,
        simplifiedNotificationEditor: true,
      },
    };
  }

  if (hasDataQueries && !hasValidExpressions) {
    return {
      ...values,
      queries: dataQueries,
      condition: '',
      editorSettings: {
        simplifiedQueryEditor: true,
        simplifiedNotificationEditor: true,
      },
    };
  }

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

/**
 * Creates expression queries (reduce + threshold) from a simple condition configuration.
 * Shared by the main rule form and the alert rule drawer to keep expression building in one place.
 */
export function createSimpleConditionExpressions(
  simpleCondition: SimpleCondition,
  dataQueries: AlertQuery[]
): { queries: AlertQuery[]; condition: string } {
  if (dataQueries.length === 0) {
    return { queries: [], condition: '' };
  }

  const whenField = simpleCondition.whenField ?? ReducerID.last;
  const lastDataQueryRefId = dataQueries[dataQueries.length - 1].refId;

  const reduceRefId = getNextRefId(dataQueries);
  const tempQueries = [...dataQueries, { refId: reduceRefId, datasourceUid: '', queryType: '', model: {} }];
  const thresholdRefId = getNextRefId(tempQueries);

  const reduceExpression: ExpressionQuery = {
    refId: reduceRefId,
    type: ExpressionQueryType.reduce,
    datasource: { uid: ExpressionDatasourceUID, type: ExpressionDatasourceUID },
    reducer: whenField,
    expression: lastDataQueryRefId,
  };

  const thresholdExpression: ExpressionQuery = {
    refId: thresholdRefId,
    type: ExpressionQueryType.threshold,
    datasource: { uid: ExpressionDatasourceUID, type: ExpressionDatasourceUID },
    conditions: [
      {
        type: 'query',
        evaluator: {
          params: simpleCondition.evaluator.params,
          type: simpleCondition.evaluator.type,
        },
        operator: { type: 'and' },
        query: { params: [thresholdRefId] },
        reducer: { params: [], type: 'last' as const },
      },
    ],
    expression: reduceRefId,
  };

  const expressionQueries: AlertQuery[] = [
    {
      refId: reduceRefId,
      datasourceUid: ExpressionDatasourceUID,
      queryType: 'expression',
      model: reduceExpression,
    },
    {
      refId: thresholdRefId,
      datasourceUid: ExpressionDatasourceUID,
      queryType: 'expression',
      model: thresholdExpression,
    },
  ];

  return {
    queries: [...dataQueries, ...expressionQueries],
    condition: thresholdRefId,
  };
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
