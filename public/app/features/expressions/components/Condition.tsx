import { css, cx } from '@emotion/css';
import { FormEvent } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, ButtonSelect, Icon, InlineFieldRow, Input, Select, useStyles2, Stack } from '@grafana/ui';

import alertDef, { EvalFunction } from '../../alerting/state/alertDef';
import { ClassicCondition, ReducerType } from '../types';

interface Props {
  condition: ClassicCondition;
  onChange: (condition: ClassicCondition) => void;
  onRemoveCondition: (id: number) => void;
  index: number;
  refIds: Array<SelectableValue<string>>;
}

const reducerFunctions = alertDef.reducerTypes.map<{
  label: string;
  value: ReducerType;
}>((rt) => ({ label: rt.text, value: rt.value }));
const evalOperators = alertDef.evalOperators.map((eo) => ({ label: eo.text, value: eo.value }));
const evalFunctions = alertDef.evalFunctions.map((ef) => ({ label: ef.text, value: ef.value }));

export const Condition = ({ condition, index, onChange, onRemoveCondition, refIds }: Props) => {
  const styles = useStyles2(getStyles);

  const onEvalOperatorChange = (evalOperator: SelectableValue<string>) => {
    onChange({
      ...condition,
      operator: { type: evalOperator.value! },
    });
  };

  const onReducerFunctionChange = (conditionFunction: SelectableValue<ReducerType>) => {
    onChange({
      ...condition,
      reducer: { type: conditionFunction.value!, params: [] },
    });
  };

  const onRefIdChange = (refId: SelectableValue<string>) => {
    onChange({
      ...condition,
      query: { params: [refId.value!] },
    });
  };

  const onEvalFunctionChange = (evalFunction: SelectableValue<EvalFunction>) => {
    onChange({
      ...condition,
      evaluator: { params: condition.evaluator.params, type: evalFunction.value! },
    });
  };

  const onEvaluateValueChange = (event: FormEvent<HTMLInputElement>, index: number) => {
    const newValue = parseFloat(event.currentTarget.value);
    const newParams = [...condition.evaluator.params];
    newParams[index] = newValue;

    onChange({
      ...condition,
      evaluator: { ...condition.evaluator, params: newParams },
    });
  };

  const buttonWidth = css({
    width: '75px',
  });

  const isRange =
    condition.evaluator.type === EvalFunction.IsWithinRange ||
    condition.evaluator.type === EvalFunction.IsOutsideRange ||
    condition.evaluator.type === EvalFunction.IsOutsideRangeIncluded ||
    condition.evaluator.type === EvalFunction.IsWithinRangeIncluded;

  return (
    <Stack>
      <div style={{ flex: 1 }}>
        <InlineFieldRow>
          {index === 0 ? (
            <div className={cx(styles.button, buttonWidth)}>
              <Trans i18nKey="expressions.condition.when">WHEN</Trans>
            </div>
          ) : (
            <ButtonSelect
              className={cx(styles.buttonSelectText, buttonWidth)}
              options={evalOperators}
              onChange={onEvalOperatorChange}
              value={evalOperators.find((ea) => ea.value === condition.operator!.type)}
            />
          )}
          <Select<ReducerType>
            options={reducerFunctions}
            onChange={onReducerFunctionChange}
            width={20}
            value={reducerFunctions.find((rf) => rf.value === condition.reducer.type)}
          />
          <div className={styles.button}>
            <Trans i18nKey="expressions.condition.of">OF</Trans>
          </div>
          <Select
            onChange={onRefIdChange}
            options={refIds}
            width={'auto'}
            value={refIds.find((r) => r.value === condition.query.params[0])}
          />
        </InlineFieldRow>
        <InlineFieldRow>
          <ButtonSelect
            className={styles.buttonSelectText}
            options={evalFunctions}
            onChange={onEvalFunctionChange}
            value={evalFunctions.find((ef) => ef.value === condition.evaluator.type)}
          />
          {isRange ? (
            <>
              <Input
                type="number"
                width={10}
                onChange={(event) => onEvaluateValueChange(event, 0)}
                value={condition.evaluator.params[0]}
              />
              <div className={styles.button}>
                <Trans i18nKey="expressions.condition.to">TO</Trans>
              </div>
              <Input
                type="number"
                width={10}
                onChange={(event) => onEvaluateValueChange(event, 1)}
                value={condition.evaluator.params[1]}
              />
            </>
          ) : condition.evaluator.type !== EvalFunction.HasNoValue ? (
            <Input
              type="number"
              width={10}
              onChange={(event) => onEvaluateValueChange(event, 0)}
              value={condition.evaluator.params[0]}
            />
          ) : null}
        </InlineFieldRow>
      </div>
      <Button variant="secondary" type="button" onClick={() => onRemoveCondition(index)}>
        <Icon name="trash-alt" />
      </Button>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const buttonStyle = css({
    color: theme.colors.primary.text,
    fontSize: theme.typography.bodySmall.fontSize,
  });
  return {
    buttonSelectText: buttonStyle,
    button: cx(
      css({
        display: 'flex',
        alignItems: 'center',
        borderRadius: theme.shape.radius.default,
        fontWeight: theme.typography.fontWeightMedium,
        border: `1px solid ${theme.colors.border.weak}`,
        whiteSpace: 'nowrap',
        padding: `0 ${theme.spacing(1)}`,
        backgroundColor: theme.colors.background.canvas,
      }),
      buttonStyle
    ),
  };
};
