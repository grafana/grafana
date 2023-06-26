import { css } from '@emotion/css';
import React, { FormEvent } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { ButtonSelect, InlineField, InlineFieldRow, Input, Select, useStyles2 } from '@grafana/ui';
import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { ClassicCondition, ExpressionQuery, thresholdFunctions } from '../types';

interface Props {
  labelWidth: number | 'auto';
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
}

const defaultThresholdFunction = EvalFunction.IsAbove;

export const Threshold = ({ labelWidth, onChange, refIds, query }: Props) => {
  const styles = useStyles2(getStyles);

  const defaultEvaluator: ClassicCondition = {
    type: 'query',
    evaluator: {
      type: defaultThresholdFunction,
      params: [0, 0],
    },
    query: {
      params: [],
    },
    reducer: {
      params: [],
      type: 'last',
    },
  };

  const conditions = query.conditions?.length ? query.conditions : [defaultEvaluator];
  const condition = conditions[0];

  const thresholdFunction = thresholdFunctions.find((fn) => fn.value === conditions[0].evaluator?.type);

  const onRefIdChange = (value: SelectableValue<string>) => {
    onChange({ ...query, expression: value.value });
  };

  const onEvalFunctionChange = (value: SelectableValue<EvalFunction>) => {
    const type = value.value ?? defaultThresholdFunction;

    onChange({
      ...query,
      conditions: updateConditions(conditions, { type }),
    });
  };

  const onEvaluateValueChange = (event: FormEvent<HTMLInputElement>, index: number) => {
    const newValue = parseFloat(event.currentTarget.value);
    const newParams = [...condition.evaluator.params];
    newParams[index] = newValue;

    onChange({
      ...query,
      conditions: updateConditions(conditions, { params: newParams }),
    });
  };

  const isRange =
    condition.evaluator.type === EvalFunction.IsWithinRange || condition.evaluator.type === EvalFunction.IsOutsideRange;

  return (
    <InlineFieldRow>
      <InlineField label="Input" labelWidth={labelWidth}>
        <Select onChange={onRefIdChange} options={refIds} value={query.expression} width={20} />
      </InlineField>
      <ButtonSelect
        className={styles.buttonSelectText}
        options={thresholdFunctions}
        onChange={onEvalFunctionChange}
        value={thresholdFunction}
      />
      {isRange ? (
        <>
          <Input
            type="number"
            width={10}
            onChange={(event) => onEvaluateValueChange(event, 0)}
            defaultValue={condition.evaluator.params[0]}
          />
          <div className={styles.button}>TO</div>
          <Input
            type="number"
            width={10}
            onChange={(event) => onEvaluateValueChange(event, 1)}
            defaultValue={condition.evaluator.params[1]}
          />
        </>
      ) : (
        <Input
          type="number"
          width={10}
          onChange={(event) => onEvaluateValueChange(event, 0)}
          defaultValue={conditions[0].evaluator.params[0] || 0}
        />
      )}
    </InlineFieldRow>
  );
};

function updateConditions(
  conditions: ClassicCondition[],
  update: Partial<{
    params: number[];
    type: EvalFunction;
  }>
): ClassicCondition[] {
  return [
    {
      ...conditions[0],
      evaluator: {
        ...conditions[0].evaluator,
        ...update,
      },
    },
  ];
}

const getStyles = (theme: GrafanaTheme2) => ({
  buttonSelectText: css`
    color: ${theme.colors.primary.text};
    font-size: ${theme.typography.bodySmall.fontSize};
    text-transform: uppercase;
  `,
  button: css`
    height: 32px;

    color: ${theme.colors.primary.text};
    font-size: ${theme.typography.bodySmall.fontSize};
    text-transform: uppercase;

    display: flex;
    align-items: center;
    border-radius: ${theme.shape.borderRadius(1)};
    font-weight: ${theme.typography.fontWeightBold};
    border: 1px solid ${theme.colors.border.medium};
    white-space: nowrap;
    padding: 0 ${theme.spacing(1)};
    background-color: ${theme.colors.background.primary};
  `,
});
