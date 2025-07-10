import { isNumber } from 'lodash';

import { GrafanaTheme2 } from '../themes/types';
import { reduceField, ReducerID } from '../transformations/fieldReducer';
import { DataFrame, Field, FieldConfig, FieldType, NumericRange } from '../types/dataFrame';
import { Threshold } from '../types/thresholds';

import { getFieldColorModeForField } from './fieldColor';
import { getActiveThresholdForValue } from './thresholds';

export interface ColorScaleValue {
  percent: number; // 0-1
  threshold: Threshold | undefined;
  color: string;
}

export type ScaleCalculator = (value: number) => ColorScaleValue;

export function getScaleCalculator(field: Field, theme: GrafanaTheme2): ScaleCalculator {
  if (field.type === FieldType.boolean) {
    return getBooleanScaleCalculator(field, theme);
  }

  const mode = getFieldColorModeForField(field);
  const getColor = mode.getCalculator(field, theme);
  const info = field.state?.range ?? getMinMaxAndDelta(field);

  return (value: number) => {
    let percent = 0;

    if (value !== -Infinity) {
      percent = (value - info.min!) / info.delta;

      if (Number.isNaN(percent)) {
        percent = 0;
      }
    }

    const threshold = getActiveThresholdForValue(field, value, percent);

    return {
      percent,
      threshold,
      color: getColor(value, percent, threshold),
    };
  };
}

function getBooleanScaleCalculator(field: Field, theme: GrafanaTheme2): ScaleCalculator {
  const trueValue: ColorScaleValue = {
    color: theme.visualization.getColorByName('green'),
    percent: 1,
    threshold: undefined,
  };

  const falseValue: ColorScaleValue = {
    color: theme.visualization.getColorByName('red'),
    percent: 0,
    threshold: undefined,
  };

  const mode = getFieldColorModeForField(field);
  if (mode.isContinuous && mode.getColors) {
    const colors = mode.getColors(theme);
    trueValue.color = colors[colors.length - 1];
    falseValue.color = colors[0];
  }

  return (value: number) => {
    return Boolean(value) ? trueValue : falseValue;
  };
}

export function findNumericFieldMinMax(data: DataFrame[]): NumericRange {
  let min: number | null = null;
  let max: number | null = null;

  const reducers = [ReducerID.min, ReducerID.max];

  for (const frame of data) {
    for (const field of frame.fields) {
      if (field.type === FieldType.number) {
        const stats = reduceField({ field, reducers });
        const statsMin = stats[ReducerID.min];
        const statsMax = stats[ReducerID.max];

        if (min === null || statsMin < min) {
          min = statsMin;
        }
        if (max === null || statsMax > max) {
          max = statsMax;
        }
      } else if (field.type === FieldType.frame) {
        const { min: newMin, max: newMax } = findNumericFieldMinMax(field.values);
        if (min === null || (newMin != null && newMin < min)) {
          min = newMin ?? null;
        }
        if (max === null || (newMax != null && newMax > max)) {
          max = newMax ?? null;
        }
      }
    }
  }

  return { min, max, delta: (max ?? 0) - (min ?? 0) };
}

export function getMinMaxAndDelta(field: Field): NumericRange {
  if (field.type !== FieldType.number && field.type !== FieldType.frame) {
    return { min: 0, max: 100, delta: 100 };
  }

  let min = field.config.min;
  let max = field.config.max;

  // Calculate min/max if required
  if (!isNumber(min) || !isNumber(max)) {
    let calculatedMin = 0;
    let calculatedMax = 100;
    if (field.values && field.values.length) {
      if (field.type === FieldType.frame) {
        const result = findNumericFieldMinMax(field.values);
        calculatedMin = result.min != null ? result.min : calculatedMin;
        calculatedMax = result.max != null ? result.max : calculatedMax;
      } else if (field.type === FieldType.number) {
        const stats = reduceField({ field, reducers: [ReducerID.min, ReducerID.max] });
        calculatedMin = stats[ReducerID.min];
        calculatedMax = stats[ReducerID.max];
      }
    }

    min = isNumber(min) ? min : calculatedMin;
    max = isNumber(max) ? max : calculatedMax;
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
