import { FALLBACK_COLOR, Field, FieldColorMode, GrafanaTheme, Threshold } from '../types';
import { classicColors, getColorFromHexRgbOrName, Registry, RegistryItem } from '../utils';
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
      id: FieldColorMode.SpectrumGrYlRd,
      name: 'Spectrum > Green-Yellow-Red',
      getCalculator: (field, seriesIndex, theme) => {
        const colors = ['green', 'yellow', 'red'].map(c => getColorFromHexRgbOrName(c, theme.type));
        const interpolator = interpolateRgbBasis(colors);

        return (value, percent) => {
          return interpolator(percent);
        };
      },
    },
    {
      id: FieldColorMode.PaletteClassic,
      name: 'Palette > Classic',
      getCalculator: (field, seriesIndex) => {
        return () => {
          return classicColors[seriesIndex % classicColors.length];
        };
      },
    },
    {
      id: FieldColorMode.PaletteVibrant,
      name: 'Palette > Vibrant',
      getCalculator: (field, seriesIndex, theme: GrafanaTheme) => {
        const namedColors = [
          'blue',
          'red',
          'green',
          'yellow',
          'purple',
          'orange',
          'dark-blue',
          'dark-red',
          'dark-yellow',
          'dark-purple',
          'dark-orange',
        ];
        return () => {
          return getColorFromHexRgbOrName(namedColors[seriesIndex % namedColors.length], theme.type);
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
