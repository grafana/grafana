import { useEffect, useState } from 'react';

import { ReducerID } from '@grafana/data';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { ExpressionQuery } from 'app/features/expressions/types';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { SimplifiedEditor } from '../../../types/rule-form';

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
  editorSettings: SimplifiedEditor | undefined,
  isGrafanaAlertingType: boolean,
  isNewFromQueryParams: boolean,
  dataQueries: Array<AlertQuery<ExpressionQuery | AlertDataQuery>>,
  expressionQueries: Array<AlertQuery<ExpressionQuery>>
) {
  const queryParamsAreTransformable = areQueriesTransformableToSimpleCondition(dataQueries, expressionQueries);
  return (
    Boolean(editorSettings?.simplifiedQueryEditor) === false ||
    !isGrafanaAlertingType ||
    (isNewFromQueryParams && !queryParamsAreTransformable)
  );
}

/*
  This hook is used mantain the state of the advanced mode, and the simple condition, 
  depending on the editor settings, the alert type, and the queries.
   */
export const useAdvancedMode = (
  editorSettings: SimplifiedEditor | undefined,
  isGrafanaAlertingType: boolean,
  isNewFromQueryParams: boolean,
  dataQueries: Array<AlertQuery<ExpressionQuery | AlertDataQuery>>,
  expressionQueries: Array<AlertQuery<ExpressionQuery>>
) => {
  const isAdvancedMode = determineAdvancedMode(
    editorSettings,
    isGrafanaAlertingType,
    isNewFromQueryParams,
    dataQueries,
    expressionQueries
  );

  const [simpleCondition, setSimpleCondition] = useState<SimpleCondition>(
    initializeSimpleCondition(isGrafanaAlertingType, dataQueries, expressionQueries)
  );

  useEffect(() => {
    if (!isAdvancedMode && isGrafanaAlertingType) {
      setSimpleCondition(getSimpleConditionFromExpressions(expressionQueries));
    }
  }, [isAdvancedMode, expressionQueries, isGrafanaAlertingType]);

  return { isAdvancedMode, simpleCondition, setSimpleCondition };
};
