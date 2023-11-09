import { css } from '@emotion/css';
import { AnyAction } from '@reduxjs/toolkit';
import React, { FormEvent, useEffect, useReducer } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { ButtonSelect, InlineField, InlineFieldRow, InlineSwitch, Input, Select, useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { ClassicCondition, ExpressionQuery, thresholdFunctions } from '../types';

import {
  isInvalid,
  thresholdReducer,
  updateHysteresisChecked,
  updateRefId,
  updateThresholdParams,
  updateThresholdType,
  updateUnloadParams,
} from './thresholdReducer';

interface Props {
  labelWidth: number | 'auto';
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
  onError?: (error: string | undefined) => void;
}

const defaultThresholdFunction = EvalFunction.IsAbove;

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

export const Threshold = ({ labelWidth, onChange, refIds, query, onError }: Props) => {
  const styles = useStyles2(getStyles);

  const initialExpression = { ...query, conditions: query.conditions?.length ? query.conditions : [defaultEvaluator] };

  // this queryState is the source of truth for the threshold component.
  // All the changes are made to this object through the dispatch function with the thresholdReducer.
  const [queryState, dispatch] = useReducer(thresholdReducer, initialExpression);
  const conditionInState = queryState.conditions[0];

  const thresholdFunction = thresholdFunctions.find((fn) => fn.value === queryState.conditions[0].evaluator?.type);

  const onRefIdChange = (value: SelectableValue<string>) => {
    dispatch(updateRefId(value.value));
  };

  // any change in the queryState will trigger the onChange function.
  useEffect(() => {
    queryState && onChange(queryState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryState]);

  const onEvalFunctionChange = (value: SelectableValue<EvalFunction>) => {
    dispatch(updateThresholdType({ evalFunction: value.value ?? defaultThresholdFunction, onError }));
  };

  const onEvaluateValueChange = (event: FormEvent<HTMLInputElement>, index: number) => {
    dispatch(updateThresholdParams({ param: parseFloat(event.currentTarget.value), index }));
  };

  const isRange =
    conditionInState.evaluator.type === EvalFunction.IsWithinRange ||
    conditionInState.evaluator.type === EvalFunction.IsOutsideRange;

  const hysteresisEnabled = Boolean(config.featureToggles?.recoveryThreshold);

  interface HysteresisSectionProps {
    isRange: boolean;
    onError?: (error: string | undefined) => void;
  }

  const HysteresisSection = ({ isRange, onError }: HysteresisSectionProps) => {
    const hasHysteresis = Boolean(conditionInState.unloadEvaluator);

    const onHysteresisCheckChange = (event: FormEvent<HTMLInputElement>) => {
      dispatch(updateHysteresisChecked({ hysteresisChecked: event.currentTarget.checked, onError }));
    };
    return (
      <div className={styles.hysteresis}>
        <InlineSwitch
          showLabel={true}
          label="Custom recovery threshold"
          value={hasHysteresis}
          onChange={onHysteresisCheckChange}
          // transparent={true}
          className={styles.switch}
        />

        {hasHysteresis && (
          <RecoveryThresholdRow
            isRange={isRange}
            conditions={queryState.conditions}
            condition={conditionInState}
            labelWidth={labelWidth}
            onChange={onChange}
            query={query}
            onError={onError}
            dispatch={dispatch}
          />
        )}
      </div>
    );
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Input" labelWidth={labelWidth}>
          <Select onChange={onRefIdChange} options={refIds} value={query.expression} width={20} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
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
              defaultValue={conditionInState.evaluator.params[0]}
            />
            <div className={styles.button}>TO</div>
            <Input
              type="number"
              width={10}
              onChange={(event) => onEvaluateValueChange(event, 1)}
              defaultValue={conditionInState.evaluator.params[1]}
            />
          </>
        ) : (
          <Input
            type="number"
            width={10}
            onChange={(event) => onEvaluateValueChange(event, 0)}
            defaultValue={conditionInState.evaluator.params[0] || 0}
          />
        )}
      </InlineFieldRow>
      {hysteresisEnabled && <HysteresisSection isRange={isRange} onError={onError} />}
    </>
  );
};

interface RecoveryThresholdRowProps {
  isRange: boolean;
  conditions: ClassicCondition[];
  condition: ClassicCondition;
  labelWidth: number | 'auto';
  onChange: (query: ExpressionQuery) => void;
  query: ExpressionQuery;
  onError?: (error: string | undefined) => void;
  dispatch: React.Dispatch<AnyAction>;
}

function RecoveryThresholdRow({ isRange, condition, labelWidth, onError, dispatch }: RecoveryThresholdRowProps) {
  const styles = useStyles2(getStyles);

  const onUnloadValueChange = (event: FormEvent<HTMLInputElement>, paramIndex: number) => {
    const newValue = parseFloat(event.currentTarget.value);
    dispatch(updateUnloadParams({ param: newValue, index: paramIndex, onError }));
  };

  // check if is valid for the current unload evaluator params
  const error = isInvalid(condition);
  // get the error message depending on the unload evaluator type
  const { errorMsg: invalidErrorMsg, errorMsgFrom, errorMsgTo } = error ?? {};

  if (isRange) {
    if (condition.evaluator.type === EvalFunction.IsWithinRange) {
      return (
        <InlineFieldRow className={styles.hysteresis}>
          <InlineField label="Stop alerting when outside range" labelWidth={labelWidth}>
            <Stack direction="row" gap={0}>
              <div className={styles.range}>
                <InlineField invalid={Boolean(errorMsgFrom)} error={errorMsgFrom} className={styles.noMargin}>
                  <Input
                    type="number"
                    width={10}
                    onChange={(event) => onUnloadValueChange(event, 0)}
                    defaultValue={condition.unloadEvaluator?.params[0]}
                  />
                </InlineField>
              </div>
              <div className={styles.button}>TO</div>
              <div className={styles.range}>
                <InlineField invalid={Boolean(errorMsgTo)} error={errorMsgTo}>
                  <Input
                    type="number"
                    width={10}
                    onChange={(event) => onUnloadValueChange(event, 1)}
                    defaultValue={condition.unloadEvaluator?.params[1]}
                  />
                </InlineField>
              </div>
            </Stack>
          </InlineField>
        </InlineFieldRow>
      );
    } else {
      return (
        <InlineFieldRow className={styles.hysteresis}>
          <InlineField label="Stop alerting when inside range" labelWidth={labelWidth}>
            <Stack direction="row" gap={0}>
              <div className={styles.range}>
                <InlineField invalid={Boolean(errorMsgFrom)} error={errorMsgFrom}>
                  <Input
                    type="number"
                    width={10}
                    onChange={(event) => onUnloadValueChange(event, 0)}
                    defaultValue={condition.unloadEvaluator?.params[0]}
                  />
                </InlineField>
              </div>

              <div className={styles.button}>TO</div>
              <div className={styles.range}>
                <InlineField invalid={Boolean(errorMsgTo)} error={errorMsgTo}>
                  <Input
                    type="number"
                    width={10}
                    onChange={(event) => onUnloadValueChange(event, 1)}
                    defaultValue={condition.unloadEvaluator?.params[1]}
                  />
                </InlineField>
              </div>
            </Stack>
          </InlineField>
        </InlineFieldRow>
      );
    }
  } else {
    if (condition.evaluator.type === EvalFunction.IsAbove) {
      return (
        <InlineFieldRow className={styles.hysteresis}>
          <InlineField
            label="Stop alerting when below"
            labelWidth={labelWidth}
            invalid={Boolean(invalidErrorMsg)}
            error={invalidErrorMsg}
          >
            <Input
              type="number"
              width={10}
              onChange={(event) => onUnloadValueChange(event, 0)}
              defaultValue={condition.unloadEvaluator?.params[0]}
            />
          </InlineField>
        </InlineFieldRow>
      );
    } else {
      return (
        <InlineFieldRow className={styles.hysteresis}>
          <InlineField
            label="Stop alerting when above"
            labelWidth={labelWidth}
            invalid={Boolean(invalidErrorMsg)}
            error={invalidErrorMsg}
          >
            <Input
              type="number"
              width={10}
              onChange={(event) => onUnloadValueChange(event, 0)}
              defaultValue={condition.unloadEvaluator?.params[0]}
            />
          </InlineField>
        </InlineFieldRow>
      );
    }
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  buttonSelectText: css({
    color: theme.colors.primary.text,
    fontSize: theme.typography.bodySmall.fontSize,
    textTransform: 'uppercase',
    padding: `0 ${theme.spacing(1)}`,
  }),
  button: css({
    height: '32px',
    color: theme.colors.primary.text,
    fontSize: theme.typography.bodySmall.fontSize,
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    borderRadius: theme.shape.radius.default,
    fontWeight: theme.typography.fontWeightBold,
    border: `1px solid ${theme.colors.border.medium}`,
    whiteSpace: 'nowrap',
    padding: `0 ${theme.spacing(1)}`,
    backgroundColor: theme.colors.background.primary,
  }),
  range: css({
    width: 'min-content',
  }),
  hysteresis: css({
    marginTop: theme.spacing(0.5),
  }),
  switch: css({
    paddingLeft: theme.spacing(1),
  }),
  noMargin: css({
    margin: 0,
  }),
});
