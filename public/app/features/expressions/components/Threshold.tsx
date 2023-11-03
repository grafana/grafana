import { css } from '@emotion/css';
import { produce } from 'immer';
import React, { FormEvent } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { ButtonSelect, InlineField, InlineFieldRow, InlineSwitch, Input, Select, useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { ClassicCondition, ExpressionQuery, thresholdFunctions } from '../types';

export function isInvalid(condition: ClassicCondition) {
  const { unloadEvaluator, evaluator } = condition;

  if (unloadEvaluator?.params[0] === undefined) {
    return { errorMsg: 'This value cannot be empty' };
  }

  if (!evaluator) {
    return;
  }

  const [firstParamInUnloadEvaluator, secondParamInUnloadEvaluator] = unloadEvaluator.params;

  const { type, params } = evaluator;
  const [firstParamInEvaluator, secondParamInEvaluator] = params;

  switch (type) {
    case EvalFunction.IsAbove:
      if (firstParamInUnloadEvaluator > firstParamInEvaluator) {
        return { errorMsg: `Enter a number less than or equal to ${firstParamInEvaluator}` };
      }
      break;
    case EvalFunction.IsBelow:
      if (firstParamInUnloadEvaluator < firstParamInEvaluator) {
        return { errorMsg: `Enter a number more than or equal to ${firstParamInEvaluator}` };
      }
      break;
    case EvalFunction.IsOutsideRange:
      if (firstParamInUnloadEvaluator < firstParamInEvaluator) {
        return { errorMsgFrom: `Enter a number more than or equal to ${firstParamInEvaluator}` };
      }
      if (secondParamInUnloadEvaluator > secondParamInEvaluator) {
        return { errorMsgTo: `Enter a number less than or equal to ${secondParamInEvaluator}` };
      }
      break;
    case EvalFunction.IsWithinRange:
      if (firstParamInUnloadEvaluator > firstParamInEvaluator) {
        return { errorMsgFrom: `Enter a number less than or equal to ${firstParamInEvaluator}` };
      }
      if (secondParamInUnloadEvaluator < secondParamInEvaluator) {
        return { errorMsgTo: `Enter a number be more than or equal to ${secondParamInEvaluator}` };
      }
      break;
    default:
      throw new Error(`evaluator function type ${type} not supported.`);
  }
  return;
}

interface Props {
  labelWidth: number | 'auto';
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
  onError?: (error: string | undefined) => void;
}

const defaultThresholdFunction = EvalFunction.IsAbove;
const defaultUnloadThresholdFunction = EvalFunction.IsBelow;

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
      conditions: updateEvaluatorConditions(conditions, { type }, onError),
    });
  };

  const onEvaluateValueChange = (event: FormEvent<HTMLInputElement>, index: number) => {
    const newCondition = produce(condition, (draft) => {
      draft.evaluator.params[index] = parseFloat(event.currentTarget.value);
    });

    onChange({
      ...query,
      conditions: updateEvaluatorConditions(conditions, { params: newCondition.evaluator.params }, onError),
    });
  };

  const isRange =
    condition.evaluator.type === EvalFunction.IsWithinRange || condition.evaluator.type === EvalFunction.IsOutsideRange;

  const hysteresisEnabled = Boolean(config.featureToggles?.recoveryThreshold);

  interface HysteresisSectionProps {
    isRange: boolean;
    onError?: (error: string | undefined) => void;
  }

  const HysteresisSection = ({ isRange, onError }: HysteresisSectionProps) => {
    const hasHysteresis = Boolean(condition.unloadEvaluator);

    const onHysteresisCheckChange = (event: FormEvent<HTMLInputElement>) => {
      if (!event.currentTarget.checked) {
        if (onError) {
          onError(undefined); // clear error
        }
        // change to not checked
        onChange({
          ...query,
          conditions: updateUnloadEvaluatorConditions(conditions, { params: [] }, false),
        });
      } else {
        // check to checked
        onChange({
          ...query,
          conditions: updateUnloadEvaluatorConditions(conditions, {}, true),
        });
      }
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
            conditions={conditions}
            condition={condition}
            labelWidth={labelWidth}
            onChange={onChange}
            query={query}
            onError={onError}
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
      {hysteresisEnabled && <HysteresisSection isRange={isRange} onError={onError} />}
    </>
  );
};
export function getUnloadEvaluatorTypeFromCondition(condition: ClassicCondition) {
  // we don't let the user change the unload evaluator type. We just change it to the opposite of the evaluator type
  if (condition.evaluator.type === EvalFunction.IsAbove) {
    return EvalFunction.IsBelow;
  }
  if (condition.evaluator.type === EvalFunction.IsBelow) {
    return EvalFunction.IsAbove;
  }
  if (condition.evaluator.type === EvalFunction.IsWithinRange) {
    return EvalFunction.IsOutsideRange;
  }
  if (condition.evaluator.type === EvalFunction.IsOutsideRange) {
    return EvalFunction.IsWithinRange;
  }
  return EvalFunction.IsBelow;
}

export function updateEvaluatorConditions(
  conditions: ClassicCondition[],
  update: Partial<{
    params: number[];
    type: EvalFunction;
  }>,
  onError?: (error: string | undefined) => void
): ClassicCondition[] {
  const hsyteresisIsChecked = Boolean(conditions[0].unloadEvaluator);

  const typeChanged = update.type && update.type !== conditions[0].evaluator.type;
  const newEvaluator = {
    ...conditions[0].evaluator,
    ...update,
  };

  if (typeChanged && hsyteresisIsChecked) {
    // when type whas changed and hsyteresIsChecked, we need to update the type for the unload evaluator
    const defaultUnloadEvaluator = {
      type: getUnloadEvaluatorTypeFromCondition({ ...conditions[0], evaluator: newEvaluator }),
      params: conditions[0].evaluator?.params ?? [0, 0],
    };

    const updateUnloadType = getUnloadEvaluatorTypeFromCondition({ ...conditions[0], evaluator: newEvaluator });
    // set error to undefined when type is changed as we default to the new type that is valid
    if (onError) {
      onError(undefined); //clear error
    }

    return [
      {
        ...conditions[0],
        evaluator: {
          ...conditions[0].evaluator,
          ...update,
        },
        unloadEvaluator: {
          ...defaultUnloadEvaluator,
          type: updateUnloadType,
        },
      },
    ];
  } else {
    // type was not changed or hysteresis is not checked. We just update the evaluator
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
}

function updateUnloadEvaluatorConditions(
  conditions: ClassicCondition[],
  update: Partial<{
    params: number[];
    type: EvalFunction;
  }>,
  hysteresisChecked: boolean
): ClassicCondition[] {
  const defaultUnloaEvaluator = {
    type: defaultUnloadThresholdFunction,
    params: conditions[0].evaluator?.params ?? [0, 0],
  };
  if (!hysteresisChecked) {
    return [
      {
        ...conditions[0],
        unloadEvaluator: undefined,
      },
    ];
  } else {
    const prevUnloadEvaluator = conditions[0].unloadEvaluator ?? defaultUnloaEvaluator;

    return [
      {
        ...conditions[0],
        unloadEvaluator: {
          ...prevUnloadEvaluator,
          ...update,
          type: getUnloadEvaluatorTypeFromCondition(conditions[0]),
        },
      },
    ];
  }
}

interface RecoveryThresholdRowProps {
  isRange: boolean;
  conditions: ClassicCondition[];
  condition: ClassicCondition;
  labelWidth: number | 'auto';
  onChange: (query: ExpressionQuery) => void;
  query: ExpressionQuery;
  onError?: (error: string | undefined) => void;
}

function RecoveryThresholdRow({
  isRange,
  conditions,
  condition,
  labelWidth,
  onChange,
  query,
  onError,
}: RecoveryThresholdRowProps) {
  const styles = useStyles2(getStyles);

  const onUnloadValueChange = (event: FormEvent<HTMLInputElement>, paramIndex: number) => {
    //prepare new conditions with the new unload evaluator params
    const newValue = parseFloat(event.currentTarget.value);
    const newParams = condition.unloadEvaluator
      ? [...condition.unloadEvaluator.params]
      : [...defaultEvaluator.evaluator.params]; // if there is no unload evaluator, we use the default evaluator params
    newParams[paramIndex] = newValue;

    const newConditions = updateUnloadEvaluatorConditions(conditions, { params: newParams }, true);
    // check if is valid for the new unload evaluator params
    const error = isInvalid(newConditions[0]);
    const { errorMsg: invalidErrorMsg, errorMsgFrom, errorMsgTo } = error ?? {};
    const errorMsg = invalidErrorMsg || errorMsgFrom || errorMsgTo;
    // set error in form manually as we don't have a field for the unload evaluator
    if (onError) {
      onError(errorMsg);
    }
    onChange({
      ...query,
      conditions: newConditions,
    });
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
