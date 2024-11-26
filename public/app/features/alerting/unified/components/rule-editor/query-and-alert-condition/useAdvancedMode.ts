import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { ReducerID } from '@grafana/data';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { ExpressionQuery } from 'app/features/expressions/types';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { RuleFormValues } from '../../../types/rule-form';

import { areQueriesTransformableToSimpleCondition } from './QueryAndExpressionsStep';
import { getSimpleConditionFromExpressions, SimpleCondition } from './SimpleCondition';

function initializeSimpleCondition(
  isGrafanaAlertingType: boolean,
  dataQueries: Array<AlertQuery<AlertDataQuery>>,
  expressionQueries: Array<AlertQuery<ExpressionQuery>>
) {
  if (isGrafanaAlertingType && areQueriesTransformableToSimpleCondition(dataQueries, expressionQueries)) {
    return getSimpleConditionFromExpressions(expressionQueries);
  } else {
    return {
      whenField: ReducerID.last,
      evaluator: {
        params: [0],
        type: EvalFunction.IsAbove,
      },
    };
  }
}
export function determineAdvancedMode(
  simplifiedQueryEditor: boolean | undefined,
  isGrafanaAlertingType: boolean,
  isNewFromQueryParams: boolean,
  dataQueries: Array<AlertQuery<ExpressionQuery | AlertDataQuery>>,
  expressionQueries: Array<AlertQuery<ExpressionQuery>>
) {
  const queryParamsAreTransformable = areQueriesTransformableToSimpleCondition(dataQueries, expressionQueries);
  return (
    Boolean(simplifiedQueryEditor) === false ||
    !isGrafanaAlertingType ||
    (isNewFromQueryParams && !queryParamsAreTransformable)
  );
}

/*
  This hook is used mantain the state of the advanced mode, and the simple condition, 
  depending on the editor settings, the alert type, and the queries.
   */
export const useAdvancedMode = (
  simplifiedQueryEditor: boolean | undefined,
  isGrafanaAlertingType: boolean,
  isNewFromQueryParams: boolean,
  dataQueries: Array<AlertQuery<ExpressionQuery | AlertDataQuery>>,
  expressionQueries: Array<AlertQuery<ExpressionQuery>>
) => {
  const { setValue } = useFormContext<RuleFormValues>();
  const isAdvancedMode = determineAdvancedMode(
    simplifiedQueryEditor,
    isGrafanaAlertingType,
    isNewFromQueryParams,
    dataQueries,
    expressionQueries
  );

  const [simpleCondition, setSimpleCondition] = useState<SimpleCondition>(
    initializeSimpleCondition(isGrafanaAlertingType, dataQueries, expressionQueries)
  );

  useEffect(() => {
    if (isGrafanaAlertingType) {
      setValue('editorSettings.simplifiedQueryEditor', !isAdvancedMode);
      if (!isAdvancedMode) {
        setSimpleCondition(getSimpleConditionFromExpressions(expressionQueries));
      }
    }
  }, [isAdvancedMode, expressionQueries, isGrafanaAlertingType, setValue]);

  return { simpleCondition, setSimpleCondition };
};
