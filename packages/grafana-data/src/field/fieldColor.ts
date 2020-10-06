import { FALLBACK_COLOR, Field, FieldColorModeId, GrafanaTheme, Threshold } from '../types';
import { classicColors, getColorFromHexRgbOrName, Registry, RegistryItem } from '../utils';
import { interpolateRgbBasis } from 'd3-interpolate';
import { fallBackTreshold } from './thresholds';

export type FieldValueColorCalculator = (value: number, percent: number, Threshold?: Threshold) => string;

export interface FieldColorMode extends RegistryItem {
  getCalculator: (field: Field, seriesIndex: number, theme: GrafanaTheme) => FieldValueColorCalculator;
}

export const fieldColorModeRegistry = new Registry<FieldColorMode>(() => {
  return [
    {
      id: FieldColorModeId.Thresholds,
      name: 'Discrete / From thresholds',
      description: 'Derive colors from thresholds',
      getCalculator: (_field, _seriesIndex, theme) => {
        return (_value, _percent, threshold) => {
          const thresholdSafe = threshold ?? fallBackTreshold;
          return getColorFromHexRgbOrName(thresholdSafe.color, theme.type);
        };
      },
    },
    {
      id: FieldColorModeId.ContinousGrYlRd,
      name: 'Continuous / Green-Yellow-Red',
      description: 'Derive colors from thresholds',
      getCalculator: (_field, _seriesIndex, theme) => {
        const colors = ['green', 'yellow', 'red'].map(c => getColorFromHexRgbOrName(c, theme.type));
        const interpolator = interpolateRgbBasis(colors);

        return (_value, percent) => {
          return interpolator(percent);
        };
      },
    },
    {
      id: FieldColorModeId.DiscreteClassic,
      name: 'Discrete / Classic',
      description: 'Assigns color based on series or field index',
      getCalculator: (_field, seriesIndex) => {
        return () => {
          return classicColors[seriesIndex % classicColors.length];
        };
      },
    },
    {
      id: FieldColorModeId.DiscreteVibrant,
      name: 'Discrete / Vibrant',
      description: 'Assigns color based on series or field index',
      getCalculator: (_field, seriesIndex, theme: GrafanaTheme) => {
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
      id: FieldColorModeId.Fixed,
      name: 'Fixed color',
      getCalculator: getFixedColor,
    },
  ];
});

export function getFieldColorModeFor(field: Field): FieldColorMode {
  return fieldColorModeRegistry.get(field.config.color?.mode ?? FieldColorModeId.Thresholds);
}

function getFixedColor(field: Field, _seriesIndex: number, theme: GrafanaTheme) {
  return () => {
    return getColorFromHexRgbOrName(field.config.color?.fixedColor ?? FALLBACK_COLOR, theme.type);
  };
}
