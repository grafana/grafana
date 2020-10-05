import { FALLBACK_COLOR, Field, FieldColorMode, GrafanaTheme, Threshold } from '../types';
import { getColorFromThreshold } from './thresholds';
import { getColorFromHexRgbOrName, Registry, RegistryItem } from '../utils';

export interface FieldColorResult {
  percent?: number; // 0-1
  threshold?: Threshold; // the selected step
  color?: string; // Selected color (may be range based on threshold)
}

export type FieldColorCalculator = (value: number) => FieldColorResult;

export interface FieldColorModeItem extends RegistryItem {
  getCalculator: (field: Field, seriesIndex: number, theme: GrafanaTheme) => (value: number) => FieldColorResult;
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
  return mode.getCalculator(field, seriesIndex, theme);
}

/**
 * Sorts the thresholds
 */
export function sortThresholds(thresholds: Threshold[]) {
  return thresholds.sort((t1, t2) => {
    return t1.value - t2.value;
  });
}
