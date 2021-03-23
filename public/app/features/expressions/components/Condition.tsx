import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { Button, ButtonSelect, Icon, InlineFieldRow, Input, Select, useStyles } from '@grafana/ui';
import alertDef from '../../alerting/state/alertDef';
import { ClassicCondition, ReducerType } from '../types';

interface Props {
  condition: ClassicCondition;
  onChange: (condition: ClassicCondition, index: number) => void;
  onRemoveCondition: (id: number) => void;
  index: number;
  refIds: Array<SelectableValue<string>>;
}

const reducerFunctions = alertDef.reducerTypes.map((rt) => ({ label: rt.text, value: rt.value }));
const evalOperators = alertDef.evalOperators.map((eo) => ({ label: eo.text, value: eo.value }));
const evalFunctions = alertDef.evalFunctions.map((ef) => ({ label: ef.text, value: ef.value }));

export const Condition: FC<Props> = ({ condition, index, onChange, onRemoveCondition, refIds }) => {
  const styles = useStyles(getStyles);

  const onEvalOperatorChange = (evalOperator: SelectableValue<string>) => {
    onChange(
      {
        ...condition,
        operator: { type: evalOperator.value! },
      },
      index
    );
  };

  const onReducerFunctionChange = (conditionFunction: SelectableValue<string>) => {
    onChange(
      {
        ...condition,
        reducer: { type: conditionFunction.value! as ReducerType, params: [] },
      },
      index
    );
  };

  const onRefIdChange = (refId: SelectableValue<string>) => {
    onChange(
      {
        ...condition,
        query: { params: [refId.value!] },
      },
      index
    );
  };

  const onEvalFunctionChange = (evalFunction: SelectableValue<string>) => {
    onChange(
      {
        ...condition,
        evaluator: { params: [], type: evalFunction.value! },
      },
      index
    );
  };

  const buttonWidth = css`
    width: 60px;
  `;

  return (
    <InlineFieldRow key={index}>
      {index === 0 ? (
        <div className={cx(styles.button, buttonWidth)}>WHEN</div>
      ) : (
        <ButtonSelect
          className={cx(styles.buttonSelectText, buttonWidth)}
          options={evalOperators}
          onChange={onEvalOperatorChange}
          value={evalOperators.find((ea) => ea.value === condition.operator!.type)}
        />
      )}
      <Select
        options={reducerFunctions}
        onChange={onReducerFunctionChange}
        width={20}
        value={reducerFunctions.find((rf) => rf.value === condition.reducer.type)}
      />
      <div className={styles.button}>OF</div>
      <Select onChange={onRefIdChange} options={refIds} width={15} value={condition.query.params[0]} />
      <ButtonSelect
        className={styles.buttonSelectText}
        options={evalFunctions}
        onChange={onEvalFunctionChange}
        value={evalFunctions.find((ef) => ef.value === condition.evaluator.type)}
      />
      <Input type="number" width={20} />
      <Button variant="secondary" onClick={() => onRemoveCondition(index)}>
        <Icon name="trash-alt" />
      </Button>
    </InlineFieldRow>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  const buttonStyle = css`
    color: ${theme.colors.textBlue};
    font-size: ${theme.typography.size.sm};
  `;
  return {
    buttonSelectText: buttonStyle,
    button: cx(
      css`
        display: flex;
        align-items: center;
        border-radius: ${theme.border.radius.sm};
        font-weight: ${theme.typography.weight.semibold};
        border: 1px solid ${theme.colors.border1};
        white-space: nowrap;
        padding: 0 ${theme.spacing.sm};
        background-color: ${theme.colors.bodyBg};
      `,
      buttonStyle
    ),
  };
};
