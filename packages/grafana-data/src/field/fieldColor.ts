import { FALLBACK_COLOR, Field, FieldColorMode, GrafanaTheme, Threshold } from '../types';
import { getColorFromThreshold } from './thresholds';
import { getColorFromHexRgbOrName, Registry, RegistryItem } from '../utils';

export interface GetFieldColorCalculatorOptions {
  field: Field;
  seriesIndex: number;
  theme: GrafanaTheme;
}

export type FieldValueColorCalculator = (value: number, percent: number, Threshold: Threshold) => string;

export interface FieldColorModeItem extends RegistryItem {
  getCalculator: (field: Field, seriesIndex: number, theme: GrafanaTheme) => FieldValueColorCalculator;
}

export const fieldColorModeRegistry = new Registry<FieldColorModeItem>(() => {
  return [
    {
      id: FieldColorMode.Thresholds,
      name: 'From thresholds',
      getCalculator: getColorFromThreshold,
    },
    {
      id: FieldColorMode.Fixed,
      name: 'Fixed color',
      getCalculator: getFixedColor,
    },
  ];
});

function getFixedColor(field: Field, seriesIndex: number, theme: GrafanaTheme) {
  return () => {
    return {
      color: getColorFromHexRgbOrName(field.config.color?.fixedColor ?? FALLBACK_COLOR, theme.type),
    };
  };
}

export function getFieldColorCalculator(field: Field, seriesIndex: number, theme: GrafanaTheme): FieldColorCalculator {
  const mode = fieldColorModeRegistry.get(field.config.color?.mode ?? FieldColorMode.Thresholds);
  const calculator = mode.getCalculator(field, seriesIndex, theme);

  return (value: number) => {};
}

/**
 * Sorts the thresholds
 */
export function sortThresholds(thresholds: Threshold[]) {
  return thresholds.sort((t1, t2) => {
    return t1.value - t2.value;
  });
}
