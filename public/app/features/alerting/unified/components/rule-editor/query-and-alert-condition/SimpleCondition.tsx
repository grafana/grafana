import { css } from '@emotion/css';
import { produce } from 'immer';
import { type Dispatch, type FormEvent } from 'react';
import { type UnknownAction } from 'redux';

import { type GrafanaTheme2, type PanelData, ReducerID, type SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { InlineField, InlineFieldRow, Input, Select, Stack, Text, useStyles2 } from '@grafana/ui';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { ThresholdSelect } from 'app/features/expressions/components/ThresholdSelect';
import type { ExpressionQuery } from 'app/features/expressions/schemas/expressionQuery';
import { toReduceReducerId } from 'app/features/expressions/schemas/reduce';
import { toThresholdEvalFunction } from 'app/features/expressions/schemas/threshold';
import { reducerTypes, thresholdFunctions } from 'app/features/expressions/types';
import {
  isRangeEvaluator,
  isReducerExpression,
  isThresholdExpression,
} from 'app/features/expressions/utils/expressionTypes';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { ToLabel } from '../../../../../expressions/components/ToLabel';
import { type SimpleCondition } from '../../../types/rule-form';
import { ExpressionResult } from '../../expressions/Expression';

import { updateExpression } from './reducer';

/**
 * This is the simple condition editor if the user is in the simple mode in the query section
 */
export interface SimpleConditionEditorProps {
  simpleCondition: SimpleCondition;
  onChange: (condition: SimpleCondition) => void;
  expressionQueriesList: Array<AlertQuery<ExpressionQuery>>;
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

  const isRange = isRangeEvaluator(simpleCondition.evaluator.type);

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

  const onEvaluateValueChange = (event: FormEvent<HTMLInputElement>, index = 0) => {
    const value = event.currentTarget.value;
    const numericValue = parseFloat(value) || 0; // try to convert input to a number that isn't NaN

    onChange(
      produce(simpleCondition, (draftCondition) => {
        draftCondition.evaluator.params[index] = numericValue;
      })
    );

    updateThresholdValue(numericValue, index, expressionQueriesList, dispatch);
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
        <InlineFieldRow className={styles.condition.container}>
          {simpleCondition.whenField && (
            <InlineField label={t('alerting.simple-condition-editor.label-when', 'WHEN')}>
              <Select
                options={reducerTypes}
                value={reducerTypes.find((o) => o.value === simpleCondition.whenField)}
                onChange={onReducerTypeChange}
                width={20}
              />
            </InlineField>
          )}
          <InlineField
            label={
              simpleCondition.whenField
                ? t('alerting.simple-condition-editor.label-of-query', 'OF QUERY')
                : t('alerting.simple-condition-editor.label-when-query', 'WHEN QUERY')
            }
          >
            <Stack direction="row" gap={1} alignItems="center">
              <ThresholdSelect onChange={onEvalFunctionChange} value={thresholdFunction} />
              {isRange ? (
                <>
                  <Input
                    type="number"
                    width={10}
                    // by using the key prop we can force the input to re-render whenever the defaultValue updates
                    // this is because we have a useEffect() that updates the data structure but "defaultValue" will memoize the
                    // first value before the useEffect() runs
                    key={simpleCondition.evaluator.params[0]}
                    defaultValue={simpleCondition.evaluator.params[0] ?? ''}
                    onBlur={(event) => {
                      onEvaluateValueChange(event, 0);
                    }}
                  />
                  <ToLabel />
                  <Input
                    type="number"
                    width={10}
                    key={simpleCondition.evaluator.params[1]}
                    defaultValue={simpleCondition.evaluator.params[1] ?? ''}
                    onBlur={(event) => {
                      onEvaluateValueChange(event, 1);
                    }}
                  />
                </>
              ) : (
                <Input
                  type="number"
                  width={10}
                  key={simpleCondition.evaluator.params[0]}
                  defaultValue={simpleCondition.evaluator.params[0] ?? ''}
                  data-testid={selectors.components.AlertRules.thresholdInput}
                  onBlur={(event) => {
                    onEvaluateValueChange(event, 0);
                  }}
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
  expressionQueriesList: Array<AlertQuery<ExpressionQuery>>,
  dispatch: Dispatch<UnknownAction>
) {
  // 1. make sure have have a reduce expression and that it is pointing to the data query
  const reduceModel = expressionQueriesList.map((query) => query.model).find(isReducerExpression);

  if (!reduceModel) {
    return;
  }

  // A reduce expression only has the one reducer. Some saved rules also carry a conditions[] here,
  // left over from an older shape, but nothing reads it and the backend ignores it.
  const newReduceExpression = produce(reduceModel, (draft) => {
    draft.reducer = toReduceReducerId(reducer);
  });

  dispatch(updateExpression(newReduceExpression));
}

function updateThresholdFunction(
  evaluator: EvalFunction,
  expressionQueriesList: Array<AlertQuery<ExpressionQuery>>,
  dispatch: Dispatch<UnknownAction>
) {
  const thresholdModel = expressionQueriesList.map((query) => query.model).find(isThresholdExpression);

  if (!thresholdModel) {
    return;
  }

  const newThresholdExpression = produce(thresholdModel, (draft) => {
    draft.conditions[0].evaluator.type = toThresholdEvalFunction(evaluator);
  });

  dispatch(updateExpression(newThresholdExpression));
}

function updateThresholdValue(
  value: number,
  index: number,
  expressionQueriesList: Array<AlertQuery<ExpressionQuery>>,
  dispatch: Dispatch<UnknownAction>
) {
  const thresholdModel = expressionQueriesList.map((query) => query.model).find(isThresholdExpression);

  if (!thresholdModel) {
    return;
  }

  const newThresholdExpression = produce(thresholdModel, (draft) => {
    draft.conditions[0].evaluator.params[index] = value;
  });

  dispatch(updateExpression(newThresholdExpression));
}

export function getSimpleConditionFromExpressions(expressions: Array<AlertQuery<ExpressionQuery>>): SimpleCondition {
  const models = expressions.map((query) => query.model);
  const reduceModel = models.find(isReducerExpression);
  const thresholdModel = models.find(isThresholdExpression);

  const thresholdEvaluator = thresholdModel?.conditions[0].evaluator;
  const whenField = reduceModel?.reducer;
  const params = thresholdEvaluator ? [...thresholdEvaluator.params] : [0];
  const type = thresholdEvaluator?.type ?? EvalFunction.IsAbove;

  return {
    whenField: whenField,
    evaluator: {
      params: params,
      type: type,
    },
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  buttonSelectText: css({
    color: theme.colors.primary.text,
    fontSize: theme.typography.bodySmall.fontSize,
    textTransform: 'uppercase',
    padding: `0 ${theme.spacing(1)}`,
  }),
  condition: {
    wrapper: css({
      display: 'flex',
      border: `solid 1px ${theme.colors.border.medium}`,
      flex: 1,
      height: 'fit-content',
      borderRadius: theme.shape.radius.default,
    }),
    container: css({
      display: 'flex',
      flexDirection: 'row',
      padding: theme.spacing(1),
      flex: 1,
      width: '100%',
    }),
    header: css({
      background: theme.colors.background.secondary,
      padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
      borderBottom: `solid 1px ${theme.colors.border.weak}`,
      flex: 1,
    }),
  },
});
