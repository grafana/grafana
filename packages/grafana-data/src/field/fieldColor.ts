import { FALLBACK_COLOR, Field, FieldColorModeId, GrafanaTheme, Threshold } from '../types';
import { classicColors, getColorFromHexRgbOrName, Registry, RegistryItem } from '../utils';
import { interpolateRgbBasis } from 'd3-interpolate';
import { fallBackTreshold } from './thresholds';

export type FieldValueColorCalculator = (value: number, percent: number, Threshold?: Threshold) => string;

export interface FieldColorMode extends RegistryItem {
  getCalculator: (field: Field, theme: GrafanaTheme) => FieldValueColorCalculator;
}

export const fieldColorModeRegistry = new Registry<FieldColorMode>(() => {
  return [
    {
      id: FieldColorModeId.Fixed,
      name: 'Single color',
      description: 'Set a specific color',
      getCalculator: getFixedColor,
    },
    {
      id: FieldColorModeId.Thresholds,
      name: 'From thresholds',
      description: 'Derive colors from thresholds',
      getCalculator: (_field, theme) => {
        return (_value, _percent, threshold) => {
          const thresholdSafe = threshold ?? fallBackTreshold;
          return getColorFromHexRgbOrName(thresholdSafe.color, theme.type);
        };
      },
    },
    {
      id: FieldColorModeId.PaletteSaturated,
      name: 'Saturated palette',
      description: 'Assigns color based on series or field index',
      getCalculator: (field, theme: GrafanaTheme) => {
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
        const seriesIndex = field.state?.seriesIndex ?? 0;

        return () => {
          return getColorFromHexRgbOrName(namedColors[seriesIndex % namedColors.length], theme.type);
        };
      },
    },
    {
      id: FieldColorModeId.PaletteClassic,
      name: 'Classic palette',
      description: 'Assigns color based on series or field index',
      getCalculator: field => {
        const seriesIndex = field.state?.seriesIndex ?? 0;

        return () => {
          return classicColors[seriesIndex % classicColors.length];
        };
      },
    },
    {
      id: FieldColorModeId.ContinousGrYlRd,
      name: 'Green-Yellow-Red (gradient)',
      description: 'Interpolated colors based value, min and max',
      getCalculator: (_field, theme) => {
        const colors = ['green', 'yellow', 'red'].map(c => getColorFromHexRgbOrName(c, theme.type));
        const interpolator = interpolateRgbBasis(colors);

        return (_value, percent) => {
          return interpolator(percent);
        };
      },
    },
  ];
});

export function getFieldColorModeFor(field: Field): FieldColorMode {
  return fieldColorModeRegistry.get(field.config.color?.mode ?? FieldColorModeId.Thresholds);
}

function getFixedColor(field: Field, theme: GrafanaTheme) {
  return () => {
    return getColorFromHexRgbOrName(field.config.color?.fixedColor ?? FALLBACK_COLOR, theme.type);
  };
}
