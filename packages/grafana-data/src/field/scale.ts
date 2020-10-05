import { Field, GrafanaTheme, Threshold } from '../types';

export interface ScaledValue {
  percent?: number; // 0-1
  threshold?: Threshold; // the selected step
  color?: string; // Selected color (may be range based on threshold)
}

export type ScaleCalculator = (value: number) => ScaledValue;

export interface GetFieldColorCalculatorOptions {
  field: Field;
  seriesIndex: number;
  theme: GrafanaTheme;
}

export function getScaleCalculator(field: Field, seriesIndex: number, theme: GrafanaTheme): FieldColorCalculator {
  const mode = fieldColorModeRegistry.get(field.config.color?.mode ?? FieldColorMode.Thresholds);
  const calculator = mode.getCalculator(field, seriesIndex, theme);

  return (value: number) => {};
}

interface FieldMinMaxInfo {
  min?: number | null;
  max?: number | null;
  delta: number;
}

function getMinMaxAndDelta(field: Field): FieldMinMaxInfo {
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
