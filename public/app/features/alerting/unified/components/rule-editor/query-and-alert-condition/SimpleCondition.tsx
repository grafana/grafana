import { css } from '@emotion/css';
import { produce } from 'immer';
import { Dispatch, FormEvent } from 'react';
import { UnknownAction } from 'redux';

import { GrafanaTheme2, PanelData, ReducerID, SelectableValue } from '@grafana/data';
import { ButtonSelect, InlineField, InlineFieldRow, Input, Select, Stack, Text, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { ExpressionQuery, ExpressionQueryType, reducerTypes, thresholdFunctions } from 'app/features/expressions/types';
import { getReducerType } from 'app/features/expressions/utils/expressionTypes';

import { ExpressionResult } from '../../expressions/Expression';

import { updateExpression } from './reducer';

export const SIMPLE_CONDITION_QUERY_ID = 'A';
export const SIMPLE_CONFITION_REDUCER_ID = 'B';
export const SIMPLE_CONDITION_THRESHOLD_ID = 'C';

export interface SimpleCondition {
  whenField: string;
  evaluator: {
    params: number[];
    type: EvalFunction;
  };
}

/**
 * This is the simple condition editor if the user is in the simple mode in the query section
 */
export interface SimpleConditionEditorProps {
  simpleCondition: SimpleCondition;
  onChange: (condition: SimpleCondition) => void;
  expressionQueriesList: ExpressionQuery[];
  dispatch: Dispatch<UnknownAction>;
  previewData?: PanelData;
}

/**
 *
 * This represents the simple condition editor for the alerting query section
 * The state for this simple condition is kept in the parent component
 * But we have also to keep the reducer state in sync with this condition state (both kept in the parent)
 */

export const SimpleConditionEditor = ({
  simpleCondition,
  onChange,
  expressionQueriesList,
  dispatch,
  previewData,
}: SimpleConditionEditorProps) => {
  const onReducerTypeChange = (value: SelectableValue<string>) => {
    onChange({ ...simpleCondition, whenField: value.value ?? ReducerID.last });
    updateReduceExpression(value.value ?? ReducerID.last, expressionQueriesList, dispatch);
  };

  const isRange =
    simpleCondition.evaluator.type === EvalFunction.IsWithinRange ||
    simpleCondition.evaluator.type === EvalFunction.IsOutsideRange;

  const thresholdFunction = thresholdFunctions.find((fn) => fn.value === simpleCondition.evaluator?.type);

  const onEvalFunctionChange = (value: SelectableValue<EvalFunction>) => {
    // change the condition kept in the parent
    onChange({
      ...simpleCondition,
      evaluator: { ...simpleCondition.evaluator, type: value.value ?? EvalFunction.IsAbove },
    });
    // update the reducer state where we store the queries
    updateThresholdFunction(value.value ?? EvalFunction.IsAbove, expressionQueriesList, dispatch);
  };

  const onEvaluateValueChange = (event: FormEvent<HTMLInputElement>, index?: number) => {
    if (isRange) {
      const newParams = produce(simpleCondition.evaluator.params, (draft) => {
        draft[index ?? 0] = parseFloat(event.currentTarget.value);
      });
      // update the condition kept in the parent
      onChange({ ...simpleCondition, evaluator: { ...simpleCondition.evaluator, params: newParams } });
      // update the reducer state where we store the queries
      updateThresholdValue(parseFloat(event.currentTarget.value), index ?? 0, expressionQueriesList, dispatch);
    } else {
      // update the condition kept in the parent
      onChange({
        ...simpleCondition,
        evaluator: { ...simpleCondition.evaluator, params: [parseFloat(event.currentTarget.value)] },
      });
      // update the reducer state where we store the queries
      updateThresholdValue(parseFloat(event.currentTarget.value), 0, expressionQueriesList, dispatch);
    }
  };

  const styles = useStyles2(getStyles);

  return (
    <div className={styles.condition.wrapper}>
      <Stack direction="column" gap={0} width="100%">
        <header className={styles.condition.header}>
          <Text variant="body">
            <Trans i18nKey="alerting.simpleCondition.alertCondition">Alert condition</Trans>
          </Text>
        </header>
        <InlineFieldRow>
          <InlineField label="WHEN">
            <Select
              options={reducerTypes}
              value={reducerTypes.find((o) => o.value === simpleCondition.whenField)}
              onChange={onReducerTypeChange}
              width={20}
            />
          </InlineField>
          <InlineField label="OF QUERY">
            <Stack direction="row" gap={1}>
              <ButtonSelect options={thresholdFunctions} onChange={onEvalFunctionChange} value={thresholdFunction} />
              {isRange ? (
                <>
                  <Input
                    type="number"
                    width={10}
                    value={simpleCondition.evaluator.params[0]}
                    onChange={(event) => onEvaluateValueChange(event, 0)}
                  />
                  <div>
                    <Trans i18nKey="alerting.simpleCondition.ofQuery.To">TO</Trans>
                  </div>
                  <Input
                    type="number"
                    width={10}
                    value={simpleCondition.evaluator.params[1]}
                    onChange={(event) => onEvaluateValueChange(event, 1)}
                  />
                </>
              ) : (
                <Input
                  type="number"
                  width={10}
                  onChange={onEvaluateValueChange}
                  value={simpleCondition.evaluator.params[0] || 0}
                />
              )}
            </Stack>
          </InlineField>
        </InlineFieldRow>
        {previewData?.series && <ExpressionResult series={previewData?.series} isAlertCondition={true} />}
      </Stack>
    </div>
  );
};

function updateReduceExpression(
  reducer: string,
  expressionQueriesList: ExpressionQuery[],
  dispatch: Dispatch<UnknownAction>
) {
  const reduceExpression = expressionQueriesList.find(
    (model) => model.type === ExpressionQueryType.reduce && model.refId === SIMPLE_CONFITION_REDUCER_ID
  );

  const newReduceExpression = produce(reduceExpression, (draft) => {
    if (draft && draft.conditions) {
      draft.reducer = reducer;
      draft.conditions[0].reducer.type = getReducerType(reducer) ?? ReducerID.last;
    }
  });
  newReduceExpression && dispatch(updateExpression(newReduceExpression));
}

function updateThresholdFunction(
  evaluator: EvalFunction,
  expressionQueriesList: ExpressionQuery[],
  dispatch: Dispatch<UnknownAction>
) {
  const thresholdExpression = expressionQueriesList.find(
    (model) => model.type === ExpressionQueryType.threshold && model.refId === SIMPLE_CONDITION_THRESHOLD_ID
  );

  const newThresholdExpression = produce(thresholdExpression, (draft) => {
    if (draft && draft.conditions) {
      draft.conditions[0].evaluator.type = evaluator;
    }
  });
  newThresholdExpression && dispatch(updateExpression(newThresholdExpression));
}

function updateThresholdValue(
  value: number,
  index: number,
  expressionQueriesList: ExpressionQuery[],
  dispatch: Dispatch<UnknownAction>
) {
  const thresholdExpression = expressionQueriesList.find(
    (model) => model.type === ExpressionQueryType.threshold && model.refId === SIMPLE_CONDITION_THRESHOLD_ID
  );

  const newThresholdExpression = produce(thresholdExpression, (draft) => {
    if (draft && draft.conditions) {
      draft.conditions[0].evaluator.params[index] = value;
    }
  });
  newThresholdExpression && dispatch(updateExpression(newThresholdExpression));
}

export function getSimpleConditionFromExpressions(expressions: ExpressionQuery[]): SimpleCondition {
  const reduceExpression = expressions.find(
    (query) => query.type === ExpressionQueryType.reduce && query.refId === SIMPLE_CONFITION_REDUCER_ID
  );
  const thresholdExpression = expressions.find(
    (query) => query.type === ExpressionQueryType.threshold && query.refId === SIMPLE_CONDITION_THRESHOLD_ID
  );
  const conditionsFromThreshold = thresholdExpression?.conditions ?? [];
  return {
    whenField: reduceExpression?.reducer ?? ReducerID.last,
    evaluator: {
      params: [...conditionsFromThreshold[0]?.evaluator?.params] ?? [0],
      type: conditionsFromThreshold[0]?.evaluator?.type ?? EvalFunction.IsAbove,
    },
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  condition: {
    wrapper: css({
      display: 'flex',
      border: `solid 1px ${theme.colors.border.medium}`,
      flex: 1,
      height: 'fit-content',
      borderRadius: theme.shape.radius.default,
    }),
    header: css({
      background: theme.colors.background.secondary,
      padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
      borderBottom: `solid 1px ${theme.colors.border.weak}`,
      flex: 1,
    }),
  },
});
