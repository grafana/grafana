import { FALLBACK_COLOR, Field, FieldColorMode, GrafanaTheme, Threshold } from '../types';
import { getColorFromHexRgbOrName, Registry, RegistryItem } from '../utils';
import { interpolateRgbBasis } from 'd3-interpolate';

export type FieldValueColorCalculator = (value: number, percent: number, Threshold?: Threshold) => string;

export interface FieldColorModeItem extends RegistryItem {
  getCalculator: (field: Field, seriesIndex: number, theme: GrafanaTheme) => FieldValueColorCalculator;
}

export const fieldColorModeRegistry = new Registry<FieldColorModeItem>(() => {
  return [
    {
      id: FieldColorMode.Thresholds,
      name: 'From thresholds',
      getCalculator: (field, seriesIndex, theme) => {
        return (value, percent, threshold) => {
          return getColorFromHexRgbOrName(threshold!.color, theme.type);
        };
      },
    },
    {
      id: FieldColorMode.SchemeGrYlRd,
      name: 'Scheme Green-Yellow-Red',
      getCalculator: (field, seriesIndex, theme) => {
        const colors = ['green', 'yellow', 'red'].map(c => getColorFromHexRgbOrName(c, theme.type));
        const interpolator = interpolateRgbBasis(colors);

        return (value, percent) => {
          return interpolator(percent);
        };
      },
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
    return getColorFromHexRgbOrName(field.config.color?.fixedColor ?? FALLBACK_COLOR, theme.type);
  };
}
