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
    new FieldColorSchemeMode({
      id: FieldColorModeId.PaletteSaturated,
      name: 'Saturated palette',
      description: 'Assigns color based on series or field index',
      isDiscrete: true,
      isByValue: false,
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
    new FieldColorSchemeMode({
      id: FieldColorModeId.PaletteClassic,
      name: 'Classic palette',
      description: 'Assigns color based on series or field index',
      isDiscrete: true,
      isByValue: false,
      colors: classicColors,
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinousGrYlRd,
      name: 'Green-Yellow-Red (gradient)',
      description: 'Interpolated colors based value, min and max',
      isDiscrete: false,
      isByValue: true,
      colors: ['green', 'yellow', 'red'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinousBlGrOr,
      name: 'Blue-Green-Orange (gradient)',
      description: 'Interpolated colors based value, min and max',
      isDiscrete: false,
      isByValue: true,
      colors: ['blue', 'green', 'orange'],
    }),
  ];
});

interface FieldColorSchemeModeOptions {
  id: FieldColorModeId;
  name: string;
  description: string;
  colors: string[];
  isDiscrete: boolean;
  isByValue: boolean;
}

export class FieldColorSchemeMode implements FieldColorMode {
  id: string;
  name: string;
  description: string;
  colors: string[];
  isDiscrete: boolean;
  isByValue: boolean;
  colorCache?: string[];
  interpolator?: (value: number) => string;

  constructor(options: FieldColorSchemeModeOptions) {
    this.id = options.id;
    this.name = options.name;
    this.description = options.description;
    this.colors = options.colors;
    this.isDiscrete = options.isDiscrete;
    this.isByValue = options.isByValue;
  }

  private getColors(theme: GrafanaTheme) {
    if (this.colorCache) {
      return this.colorCache;
    }

    this.colorCache = this.colors.map(c => getColorFromHexRgbOrName(c, theme.type));
    return this.colorCache;
  }

  private getInterpolator() {
    if (!this.interpolator) {
      this.interpolator = interpolateRgbBasis(this.colorCache!);
    }

    return this.interpolator;
  }

  getCalculator(field: Field, theme: GrafanaTheme) {
    const colors = this.getColors(theme);

    if (this.isByValue) {
      if (this.isDiscrete) {
        return (_: number, percent: number, _threshold?: Threshold) => {
          return colors[percent * (colors.length - 1)];
        };
      } else {
        return (_: number, percent: number, _threshold?: Threshold) => {
          return this.getInterpolator()(percent);
        };
      }
    } else {
      const seriesIndex = field.state?.seriesIndex ?? 0;

      return (_: number, _percent: number, _threshold?: Threshold) => {
        return colors[seriesIndex % colors.length];
      };
    }
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
