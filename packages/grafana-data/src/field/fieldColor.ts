import { FALLBACK_COLOR, Field, FieldColorModeId, GrafanaTheme, Threshold } from '../types';
import { classicColors, getColorFromHexRgbOrName, Registry, RegistryItem } from '../utils';
import { interpolateRgbBasis } from 'd3-interpolate';
import { fallBackTreshold } from './thresholds';

export type FieldValueColorCalculator = (value: number, percent: number, Threshold?: Threshold) => string;

export interface FieldColorMode extends RegistryItem {
  getCalculator: (field: Field, theme: GrafanaTheme) => FieldValueColorCalculator;
  colors?: string[];
  isContinuous?: boolean;
  isByValue?: boolean;
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
    new PaletteColorMode({
      id: FieldColorModeId.PaletteSaturated,
      name: 'Saturated palette',
      description: 'Assigns color based on series or field index',
      colors: [
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
      ],
    }),
    new PaletteColorMode({
      id: FieldColorModeId.PaletteClassic,
      name: 'Classic palette',
      description: 'Assigns color based on series or field index',
      colors: classicColors,
    }),
    new GradientColorMode({
      id: FieldColorModeId.ContinousGrYlRd,
      name: 'Green-Yellow-Red (gradient)',
      description: 'Interpolated colors based value, min and max',
      colors: ['green', 'yellow', 'red'],
    }),
    new GradientColorMode({
      id: FieldColorModeId.ContinousBlGrOr,
      name: 'Blue-Green-Orange (gradient)',
      description: 'Interpolated colors based value, min and max',
      colors: ['blue', 'green', 'orange'],
    }),
  ];
});

export class PaletteColorMode implements FieldColorMode {
  id: string;
  name: string;
  description: string;
  colors: string[];

  constructor(options: { id: FieldColorModeId; name: string; description: string; colors: string[] }) {
    this.id = options.id;
    this.name = options.name;
    this.description = options.description;
    this.colors = options.colors;
  }

  getCalculator(field: Field, theme: GrafanaTheme) {
    const seriesIndex = field.state?.seriesIndex ?? 0;

    return (_: number, _percent: number, _threshold?: Threshold) => {
      return getColorFromHexRgbOrName(this.colors[seriesIndex % this.colors.length], theme.type);
    };
  }
}

export class GradientColorMode implements FieldColorMode {
  id: string;
  name: string;
  description: string;
  colors: string[];

  constructor(options: { id: FieldColorModeId; name: string; description: string; colors: string[] }) {
    this.id = options.id;
    this.name = options.name;
    this.description = options.description;
    this.colors = options.colors;
  }

  getCalculator(_field: Field, theme: GrafanaTheme) {
    const colors = this.colors.map(c => getColorFromHexRgbOrName(c, theme.type));
    const interpolator = interpolateRgbBasis(colors);

    return (_: number, percent: number, _threshold?: Threshold) => {
      return interpolator(percent);
    };
  }
}

export function getFieldColorModeForField(field: Field): FieldColorMode {
  return fieldColorModeRegistry.get(field.config.color?.mode ?? FieldColorModeId.Thresholds);
}

export function getFieldColorMode(mode?: FieldColorModeId): FieldColorMode {
  return fieldColorModeRegistry.get(mode ?? FieldColorModeId.Thresholds);
}

function getFixedColor(field: Field, theme: GrafanaTheme) {
  return () => {
    return getColorFromHexRgbOrName(field.config.color?.fixedColor ?? FALLBACK_COLOR, theme.type);
  };
}
