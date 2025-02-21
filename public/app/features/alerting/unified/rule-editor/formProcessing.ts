import { omit } from 'lodash';

import { config } from '@grafana/runtime';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQuery, ExpressionQueryType, ReducerMode } from 'app/features/expressions/types';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { SimpleConditionIdentifier } from '../components/rule-editor/query-and-alert-condition/SimpleCondition';
import { KVObject, RuleFormValues } from '../types/rule-form';
import { defaultAnnotations } from '../utils/constants';
import { DataSourceType } from '../utils/datasource';

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
      const defaultToInstant =
        query.model.datasource?.type === DataSourceType.Loki ||
        query.model.datasource?.type === DataSourceType.Prometheus;
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

export function areQueriesTransformableToSimpleCondition(
  dataQueries: Array<AlertQuery<AlertDataQuery | ExpressionQuery>>,
  expressionQueries: Array<AlertQuery<ExpressionQuery>>
) {
  if (dataQueries.length !== 1) {
    return false;
  }
  const singleReduceExpressionInInstantQuery =
    'instant' in dataQueries[0].model && dataQueries[0].model.instant && expressionQueries.length === 1;

  if (expressionQueries.length !== 2 && !singleReduceExpressionInInstantQuery) {
    return false;
  }

  const query = dataQueries[0];

  if (query.refId !== SimpleConditionIdentifier.queryId) {
    return false;
  }

  const reduceExpressionIndex = expressionQueries.findIndex(
    (query) => query.model.type === ExpressionQueryType.reduce && query.refId === SimpleConditionIdentifier.reducerId
  );
  const reduceExpression = expressionQueries.at(reduceExpressionIndex);
  const reduceOk =
    reduceExpression &&
    reduceExpressionIndex === 0 &&
    (reduceExpression.model.settings?.mode === ReducerMode.Strict ||
      reduceExpression.model.settings?.mode === undefined);

  const thresholdExpressionIndex = expressionQueries.findIndex(
    (query) =>
      query.model.type === ExpressionQueryType.threshold && query.refId === SimpleConditionIdentifier.thresholdId
  );
  const thresholdExpression = expressionQueries.at(thresholdExpressionIndex);
  const conditions = thresholdExpression?.model.conditions ?? [];
  const thresholdIndexOk = singleReduceExpressionInInstantQuery
    ? thresholdExpressionIndex === 0
    : thresholdExpressionIndex === 1;
  const thresholdOk = thresholdExpression && thresholdIndexOk && conditions[0]?.unloadEvaluator === undefined;
  return (Boolean(reduceOk) || Boolean(singleReduceExpressionInInstantQuery)) && Boolean(thresholdOk);
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
