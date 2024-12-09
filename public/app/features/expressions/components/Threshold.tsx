import { css } from '@emotion/css';
import { AnyAction } from '@reduxjs/toolkit';
import * as React from 'react';
import { FormEvent, useEffect, useReducer } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { InlineField, InlineFieldRow, InlineSwitch, Input, Select, useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { ClassicCondition, ExpressionQuery, thresholdFunctions } from '../types';

import { ThresholdSelect } from './ThresholdSelect';
import { ToLabel } from './ToLabel';
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
  useHysteresis?: boolean;
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

export const Threshold = ({ labelWidth, onChange, refIds, query, onError, useHysteresis = false }: Props) => {
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

  const hysteresisEnabled = Boolean(config.featureToggles?.recoveryThreshold) && useHysteresis;

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Input" labelWidth={labelWidth}>
          <Select onChange={onRefIdChange} options={refIds} value={query.expression} width={20} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <ThresholdSelect onChange={onEvalFunctionChange} value={thresholdFunction} />

        {isRange ? (
          <>
            <Input
              type="number"
              width={10}
              onChange={(event) => onEvaluateValueChange(event, 0)}
              defaultValue={conditionInState.evaluator.params[0]}
            />
            <ToLabel />
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
  interface HysteresisSectionProps {
    isRange: boolean;
    onError?: (error: string | undefined) => void;
  }

  function HysteresisSection({ isRange, onError }: HysteresisSectionProps) {
    const hasHysteresis = Boolean(conditionInState.unloadEvaluator);

    const onHysteresisCheckChange = (event: FormEvent<HTMLInputElement>) => {
      dispatch(updateHysteresisChecked({ hysteresisChecked: event.currentTarget.checked, onError }));
      allowOnblurFromUnload.current = true;
    };
    const allowOnblurFromUnload = React.useRef(true);
    const onHysteresisCheckDown: React.MouseEventHandler<HTMLDivElement> | undefined = () => {
      allowOnblurFromUnload.current = false;
    };

    return (
      <div className={styles.hysteresis}>
        {/* This is to enhance the user experience for mouse users. 
        The onBlur event in RecoveryThresholdRow inputs triggers validations, 
        but we want to skip them when the switch is clicked as this click should inmount this component. 
        To achieve this, we use the onMouseDown event to set a flag, which is later utilized in the onBlur event to bypass validations. 
        The onMouseDown event precedes the onBlur event, unlike onchange. */}

        {/*Disabling the a11y rules here as the InlineSwitch handles keyboard interactions */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div onMouseDown={onHysteresisCheckDown}>
          <InlineSwitch
            showLabel={true}
            label="Custom recovery threshold"
            value={hasHysteresis}
            onChange={onHysteresisCheckChange}
            className={styles.switch}
          />
        </div>

        {hasHysteresis && (
          <RecoveryThresholdRow
            isRange={isRange}
            condition={conditionInState}
            onError={onError}
            dispatch={dispatch}
            allowOnblur={allowOnblurFromUnload}
          />
        )}
      </div>
    );
  }
};

interface RecoveryThresholdRowProps {
  isRange: boolean;
  condition: ClassicCondition;
  onError?: (error: string | undefined) => void;
  dispatch: React.Dispatch<AnyAction>;
  allowOnblur: React.MutableRefObject<boolean>;
}

function RecoveryThresholdRow({ isRange, condition, onError, dispatch, allowOnblur }: RecoveryThresholdRowProps) {
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
    return <RecoveryForRange allowOnblur={allowOnblur} />;
  } else {
    return <RecoveryForSingleValue allowOnblur={allowOnblur} />;
  }

  /* We prioritize the onMouseDown event over the onBlur event. This is because the onBlur event is executed before the onChange event that we have 
   in the hysteresis checkbox, and because of that, we were validating when unchecking the switch.
  We need to uncheck the switch before the onBlur event is executed.*/
  interface RecoveryProps {
    allowOnblur: React.MutableRefObject<boolean>;
  }

  function RecoveryForRange({ allowOnblur }: RecoveryProps) {
    if (condition.evaluator.type === EvalFunction.IsWithinRange) {
      return (
        <InlineFieldRow className={styles.hysteresis}>
          <InlineField label="Stop alerting when outside range" labelWidth={'auto'}>
            <Stack direction="row" gap={0}>
              <div className={styles.range}>
                <InlineField invalid={Boolean(errorMsgFrom)} error={errorMsgFrom} className={styles.noMargin}>
                  <Input
                    type="number"
                    width={10}
                    onBlur={(event) => allowOnblur.current && onUnloadValueChange(event, 0)}
                    defaultValue={condition.unloadEvaluator?.params[0]}
                  />
                </InlineField>
              </div>
              <ToLabel />
              <div className={styles.range}>
                <InlineField invalid={Boolean(errorMsgTo)} error={errorMsgTo}>
                  <Input
                    type="number"
                    width={10}
                    onBlur={(event) => allowOnblur.current && onUnloadValueChange(event, 1)}
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
          <InlineField label="Stop alerting when inside range" labelWidth={'auto'}>
            <Stack direction="row" gap={0}>
              <div className={styles.range}>
                <InlineField invalid={Boolean(errorMsgFrom)} error={errorMsgFrom}>
                  <Input
                    type="number"
                    width={10}
                    onBlur={(event) => allowOnblur.current && onUnloadValueChange(event, 0)}
                    defaultValue={condition.unloadEvaluator?.params[0]}
                  />
                </InlineField>
              </div>

              <ToLabel />
              <div className={styles.range}>
                <InlineField invalid={Boolean(errorMsgTo)} error={errorMsgTo}>
                  <Input
                    type="number"
                    width={10}
                    onBlur={(event) => allowOnblur.current && onUnloadValueChange(event, 1)}
                    defaultValue={condition.unloadEvaluator?.params[1]}
                  />
                </InlineField>
              </div>
            </Stack>
          </InlineField>
        </InlineFieldRow>
      );
    }
  }

  function RecoveryForSingleValue({ allowOnblur }: RecoveryProps) {
    if (condition.evaluator.type === EvalFunction.IsAbove) {
      return (
        <InlineFieldRow className={styles.hysteresis}>
          <InlineField
            label="Stop alerting when below"
            labelWidth={'auto'}
            invalid={Boolean(invalidErrorMsg)}
            error={invalidErrorMsg}
          >
            <Input
              type="number"
              width={10}
              onBlur={(event) => {
                allowOnblur.current && onUnloadValueChange(event, 0);
              }}
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
            labelWidth={'auto'}
            invalid={Boolean(invalidErrorMsg)}
            error={invalidErrorMsg}
          >
            <Input
              type="number"
              width={10}
              onBlur={(event) => {
                allowOnblur.current && onUnloadValueChange(event, 0);
              }}
              defaultValue={condition.unloadEvaluator?.params[0]}
            />
          </InlineField>
        </InlineFieldRow>
      );
    }
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  range: css({
    width: 'min-content',
  }),
  hysteresis: css({
    marginTop: theme.spacing(2),
  }),
  switch: css({
    paddingLeft: theme.spacing(1),
  }),
  noMargin: css({
    margin: 0,
  }),
});
