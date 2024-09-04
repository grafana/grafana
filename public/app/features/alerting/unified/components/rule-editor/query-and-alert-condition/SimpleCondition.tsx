import { css } from '@emotion/css';
import { produce } from 'immer';
import { Dispatch, FormEvent, useEffect } from 'react';
import { UnknownAction } from 'redux';

import { GrafanaTheme2, PanelData, ReducerID, SelectableValue } from '@grafana/data';
import { ButtonSelect, InlineField, InlineFieldRow, Input, Select, Stack, Text, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import {
  ExpressionQuery,
  ExpressionQueryType,
  getReducerType,
  reducerTypes,
  thresholdFunctions,
} from 'app/features/expressions/types';

import { ExpressionResult } from '../../expressions/Expression';

import { updateExpression } from './reducer';

export const SIMPLE_CONFITION_REDUCER_ID = 'B';
export const SIMPLE_CONDITION_THRESHOLD_ID = 'C';

export function getSimpleConditionFromExpressions(expressions: ExpressionQuery[]): SimpleCondition {
  const reduceExpression = expressions.find(
    (query) => query.type === ExpressionQueryType.reduce && query.refId === SIMPLE_CONFITION_REDUCER_ID
  );
  const thresholdExpression = expressions.find(
    (query) => query.type === ExpressionQueryType.threshold && query.refId === SIMPLE_CONDITION_THRESHOLD_ID
  );
  const conditionsFromReducer = reduceExpression?.conditions ?? [];
  const conditionsFromThreshold = thresholdExpression?.conditions ?? [];
  return {
    whenField: conditionsFromReducer[0]?.reducer?.type ?? ReducerID.last,
    evaluator: {
      params: conditionsFromThreshold[0]?.evaluator?.params ?? [0],
      type: conditionsFromThreshold[0]?.evaluator?.type ?? EvalFunction.IsAbove,
    },
  };
}

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

export const SimpleConditionEditor = ({
  simpleCondition,
  onChange,
  expressionQueriesList,
  dispatch,
  previewData,
}: SimpleConditionEditorProps) => {
  useEffect(() => {
    const reduceExpression = expressionQueriesList.find(
      (model) => model.type === ExpressionQueryType.reduce && model.refId === SIMPLE_CONFITION_REDUCER_ID
    );

    const newReduceExpression = produce(reduceExpression, (draft) => {
      if (draft && draft.conditions) {
        draft.reducer = simpleCondition.whenField;
        draft.conditions[0].reducer.type = getReducerType(simpleCondition.whenField) ?? ReducerID.last;
      }
    });
    newReduceExpression && dispatch(updateExpression(newReduceExpression));
  }, [simpleCondition.whenField, expressionQueriesList, dispatch]);

  useEffect(() => {
    const thresholdExpression = expressionQueriesList.find(
      (model) => model.type === ExpressionQueryType.threshold && model.refId === SIMPLE_CONDITION_THRESHOLD_ID
    );
    const newThresholdExpression = produce(thresholdExpression, (draft) => {
      if (draft && draft.conditions) {
        draft.conditions[0].evaluator.params = simpleCondition.evaluator.params;
        draft.conditions[0].evaluator.type = simpleCondition.evaluator.type;
      }
    });
    newThresholdExpression && dispatch(updateExpression(newThresholdExpression));
  }, [simpleCondition.evaluator.type, simpleCondition.evaluator.params, expressionQueriesList, dispatch]);

  const onReducerTypeChange = (value: SelectableValue<string>) => {
    onChange({ ...simpleCondition, whenField: value.value ?? ReducerID.last });
  };

  const isRange =
    simpleCondition.evaluator.type === EvalFunction.IsWithinRange ||
    simpleCondition.evaluator.type === EvalFunction.IsOutsideRange;

  const thresholdFunction = thresholdFunctions.find((fn) => fn.value === simpleCondition.evaluator?.type);
  const onEvalFunctionChange = (value: SelectableValue<EvalFunction>) => {
    onChange({
      ...simpleCondition,
      evaluator: { ...simpleCondition.evaluator, type: value.value ?? EvalFunction.IsAbove },
    });
  };

  const onEvaluateValueChange = (event: FormEvent<HTMLInputElement>, index?: number) => {
    if (isRange) {
      const newParams = produce(simpleCondition.evaluator.params, (draft) => {
        draft[index ?? 0] = parseFloat(event.currentTarget.value);
      });
      onChange({ ...simpleCondition, evaluator: { ...simpleCondition.evaluator, params: newParams } });
    } else {
      onChange({
        ...simpleCondition,
        evaluator: { ...simpleCondition.evaluator, params: [parseFloat(event.currentTarget.value)] },
      });
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
                    defaultValue={simpleCondition.evaluator.params[0]}
                    onChange={(event) => onEvaluateValueChange(event, 0)}
                  />
                  <div>
                    <Trans i18nKey="alerting.simpleCondition.ofQuery.To">TO</Trans>
                  </div>
                  <Input
                    type="number"
                    width={10}
                    defaultValue={simpleCondition.evaluator.params[1]}
                    onChange={(event) => onEvaluateValueChange(event, 1)}
                  />
                </>
              ) : (
                <Input
                  type="number"
                  width={10}
                  onChange={onEvaluateValueChange}
                  defaultValue={simpleCondition.evaluator.params[0] || 0}
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
