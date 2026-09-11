import { useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { ReducerID } from '@grafana/data';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { type ExpressionQuery } from 'app/features/expressions/types';
import { type AlertDataQuery, type AlertQuery } from 'app/types/unified-alerting-dto';

import { areQueriesTransformableToSimpleCondition } from '../../../rule-editor/formProcessing';
import { type SimpleCondition } from '../../../types/rule-form';

import { getSimpleConditionFromExpressions } from './SimpleCondition';

function defaultSimpleCondition(): SimpleCondition {
  return {
    whenField: ReducerID.last,
    evaluator: {
      params: [0],
      type: EvalFunction.IsAbove,
    },
  };
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

  const [simpleCondition, setSimpleCondition] = useState<SimpleCondition>(defaultSimpleCondition());

  useEffectOnce(() => {
    // Resolves the real initial value once transformability's async datasource lookup settles.
    async function resolveInitialSimpleCondition() {
      const transformable =
        isGrafanaAlertingType && (await areQueriesTransformableToSimpleCondition(dataQueries, expressionQueries));
      if (transformable) {
        setSimpleCondition(getSimpleConditionFromExpressions(expressionQueries));
      }
    }
    resolveInitialSimpleCondition();
  });

  useEffect(() => {
    if (isGrafanaAlertingType && !isAdvancedMode) {
      setSimpleCondition(getSimpleConditionFromExpressions(expressionQueries));
    }
  }, [isAdvancedMode, expressionQueries, isGrafanaAlertingType]);

  return { simpleCondition, setSimpleCondition };
};
