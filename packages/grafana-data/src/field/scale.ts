import { isNumber } from 'lodash';
import { reduceField, ReducerID } from '../transformations/fieldReducer';
import { Field, FieldConfig, FieldType, GrafanaTheme, NumericRange, Threshold } from '../types';
import { getFieldColorModeForField } from './fieldColor';
import { getActiveThresholdForValue } from './thresholds';

export interface ColorScaleValue {
  percent: number; // 0-1
  threshold: Threshold;
  color: string;
}

export type ScaleCalculator = (value: number) => ColorScaleValue;

export function getScaleCalculator(field: Field, theme: GrafanaTheme): ScaleCalculator {
  const mode = getFieldColorModeForField(field);
  const getColor = mode.getCalculator(field, theme);
  const info = field.state?.range ?? getMinMaxAndDelta(field);

  return (value: number) => {
    let percent = 0;

    if (value !== -Infinity) {
      percent = (value - info.min!) / info.delta;
    }

    const threshold = getActiveThresholdForValue(field, value, percent);

    return {
      percent,
      threshold,
      color: getColor(value, percent, threshold),
    };
  };
}

function getMinMaxAndDelta(field: Field): NumericRange {
  if (field.type !== FieldType.number) {
    return { min: 0, max: 100, delta: 100 };
  }

  // Calculate min/max if required
  let min = field.config.min;
  let max = field.config.max;

  if (!isNumber(min) || !isNumber(max)) {
    if (field.values && field.values.length) {
      const stats = reduceField({ field, reducers: [ReducerID.min, ReducerID.max] });
      if (!isNumber(min)) {
        min = stats[ReducerID.min];
      }
      if (!isNumber(max)) {
        max = stats[ReducerID.max];
      }
    } else {
      min = 0;
      max = 100;
    }
  }

  return {
    min,
    max,
    delta: max! - min!,
  };
}

/**
 * @internal
 */
export function getFieldConfigWithMinMax(field: Field, local?: boolean): FieldConfig {
  const { config } = field;
  let { min, max } = config;

  if (isNumber(min) && isNumber(max)) {
    return config;
  }

  if (local || !field.state?.range) {
    return { ...config, ...getMinMaxAndDelta(field) };
  }

  return { ...config, ...field.state.range };
}
