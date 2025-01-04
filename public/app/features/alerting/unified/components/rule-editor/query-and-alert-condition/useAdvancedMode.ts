import { useEffect, useState } from 'react';

import { ReducerID } from '@grafana/data';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { ExpressionQuery } from 'app/features/expressions/types';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { areQueriesTransformableToSimpleCondition } from '../../../rule-editor/formProcessing';

import { SimpleCondition, getSimpleConditionFromExpressions } from './SimpleCondition';

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
export function determineAdvancedMode(simplifiedQueryEditor: boolean | undefined, isGrafanaAlertingType: boolean) {
  return simplifiedQueryEditor === false || !isGrafanaAlertingType;
}

/*
  This hook is used mantain the state of the advanced mode, and the simple condition,
  depending on the editor settings, the alert type, and the queries.
   */
export const useAdvancedMode = (
  simplifiedQueryEditor: boolean | undefined,
  isGrafanaAlertingType: boolean,
  dataQueries: Array<AlertQuery<ExpressionQuery | AlertDataQuery>>,
  expressionQueries: Array<AlertQuery<ExpressionQuery>>
) => {
  const isAdvancedMode = determineAdvancedMode(simplifiedQueryEditor, isGrafanaAlertingType);

  const [simpleCondition, setSimpleCondition] = useState<SimpleCondition>(
    initializeSimpleCondition(isGrafanaAlertingType, dataQueries, expressionQueries)
  );

  useEffect(() => {
    if (isGrafanaAlertingType && !isAdvancedMode) {
      setSimpleCondition(getSimpleConditionFromExpressions(expressionQueries));
    }
  }, [isAdvancedMode, expressionQueries, isGrafanaAlertingType]);

  return { simpleCondition, setSimpleCondition };
};
