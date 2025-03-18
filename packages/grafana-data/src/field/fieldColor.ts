import { interpolateRgbBasis } from 'd3-interpolate';
import stringHash from 'string-hash';
import tinycolor from 'tinycolor2';

import { getContrastRatio } from '../themes/colorManipulator';
import { GrafanaTheme2 } from '../themes/types';
import { reduceField } from '../transformations/fieldReducer';
import { Field } from '../types/dataFrame';
import { FALLBACK_COLOR, FieldColorModeId } from '../types/fieldColor';
import { Threshold } from '../types/thresholds';
import { Registry, RegistryItem } from '../utils/Registry';

import { getScaleCalculator, ColorScaleValue } from './scale';
import { fallBackThreshold } from './thresholds';

/** @beta */
export type FieldValueColorCalculator = (value: number, percent: number, Threshold?: Threshold) => string;

/** @beta */
export interface FieldColorMode extends RegistryItem {
  getCalculator: (field: Field, theme: GrafanaTheme2) => FieldValueColorCalculator;
  getColors?: (theme: GrafanaTheme2) => string[];
  isContinuous?: boolean;
  isByValue?: boolean;
  useSeriesName?: boolean;
}

/** @internal */
export const fieldColorModeRegistry = new Registry<FieldColorMode>(() => {
  return [
    {
      id: FieldColorModeId.Fixed,
      name: 'Single color',
      description: 'Set a specific color',
      getCalculator: getFixedColor,
    },
    {
      id: FieldColorModeId.Shades,
      name: 'Shades of a color',
      description: 'Select shades of a specific color',
      getCalculator: getShadedColor,
    },
    {
      id: FieldColorModeId.Thresholds,
      name: 'From thresholds',
      isByValue: true,
      description: 'Derive colors from thresholds',
      getCalculator: (_field, theme) => {
        return (_value, _percent, threshold) => {
          const thresholdSafe = threshold ?? fallBackThreshold;
          return theme.visualization.getColorByName(thresholdSafe.color);
        };
      },
    },
    new FieldColorSchemeMode({
      id: FieldColorModeId.PaletteClassic,
      name: 'Classic palette',
      isContinuous: false,
      isByValue: false,
      getColors: (theme: GrafanaTheme2) => {
        return theme.visualization.palette;
      },
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.PaletteClassicByName,
      name: 'Classic palette (by series name)',
      isContinuous: false,
      isByValue: false,
      useSeriesName: true,
      getColors: (theme: GrafanaTheme2) => {
        return theme.visualization.palette.filter(
          (color) =>
            getContrastRatio(theme.visualization.getColorByName(color), theme.colors.background.primary) >=
            theme.colors.contrastThreshold
        );
      },
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousGrYlRd,
      name: 'Green-Yellow-Red',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['green', 'yellow', 'red'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousRdYlGr,
      name: 'Red-Yellow-Green',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['red', 'yellow', 'green'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousBlYlRd,
      name: 'Blue-Yellow-Red',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['dark-blue', 'super-light-yellow', 'dark-red'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousYlRd,
      name: 'Yellow-Red',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['super-light-yellow', 'dark-red'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousBlPu,
      name: 'Blue-Purple',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['blue', 'purple'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousYlBl,
      name: 'Yellow-Blue',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['super-light-yellow', 'dark-blue'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousBlues,
      name: 'Blues',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['panel-bg', 'dark-blue'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousReds,
      name: 'Reds',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['panel-bg', 'dark-red'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousGreens,
      name: 'Greens',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['panel-bg', 'dark-green'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousPurples,
      name: 'Purples',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['panel-bg', 'dark-purple'],
    }),
  ];
});

interface FieldColorSchemeModeOptions {
  id: FieldColorModeId;
  name: string;
  description?: string;
  getColors: (theme: GrafanaTheme2) => string[];
  isContinuous: boolean;
  isByValue: boolean;
  useSeriesName?: boolean;
}

export class FieldColorSchemeMode implements FieldColorMode {
  id: FieldColorModeId;
  name: string;
  description?: string;
  isContinuous: boolean;
  isByValue: boolean;
  useSeriesName?: boolean;
  colorCache?: string[];
  colorCacheTheme?: GrafanaTheme2;
  interpolator?: (value: number) => string;
  getNamedColors?: (theme: GrafanaTheme2) => string[];

  constructor(options: FieldColorSchemeModeOptions) {
    this.id = options.id;
    this.name = options.name;
    this.description = options.description;
    this.getNamedColors = options.getColors;
    this.isContinuous = options.isContinuous;
    this.isByValue = options.isByValue;
    this.useSeriesName = options.useSeriesName;
  }

  getColors(theme: GrafanaTheme2): string[] {
    if (!this.getNamedColors) {
      return [];
    }

    if (this.colorCache && this.colorCacheTheme === theme) {
      return this.colorCache;
    }

    this.colorCache = this.getNamedColors(theme).map(theme.visualization.getColorByName);
    this.colorCacheTheme = theme;

    return this.colorCache;
  }

  private getInterpolator() {
    if (!this.interpolator) {
      this.interpolator = interpolateRgbBasis(this.colorCache!);
    }

    return this.interpolator;
  }

  getCalculator(field: Field, theme: GrafanaTheme2) {
    const colors = this.getColors(theme);

    if (this.isByValue) {
      if (this.isContinuous) {
        return (_: number, percent: number, _threshold?: Threshold) => {
          return this.getInterpolator()(percent);
        };
      } else {
        return (_: number, percent: number, _threshold?: Threshold) => {
          return colors[percent * (colors.length - 1)];
        };
      }
    } else if (this.useSeriesName) {
      return (_: number, _percent: number, _threshold?: Threshold) => {
        return colors[Math.abs(stringHash(field.state?.displayName ?? field.name)) % colors.length];
      };
    } else {
      return (_: number, _percent: number, _threshold?: Threshold) => {
        const seriesIndex = field.state?.seriesIndex ?? 0;
        return colors[seriesIndex % colors.length];
      };
    }
  }
}

/** @beta */
export function getFieldColorModeForField(field: Field): FieldColorMode {
  return fieldColorModeRegistry.get(field.config.color?.mode ?? FieldColorModeId.Thresholds);
}

/** @beta */
export function getFieldColorMode(mode?: FieldColorModeId | string): FieldColorMode {
  return fieldColorModeRegistry.get(mode ?? FieldColorModeId.Thresholds);
}

/**
 * @alpha
 * Function that will return a series color for any given color mode. If the color mode is a by value color
 * mode it will use the field.config.color.seriesBy property to figure out which value to use
 */
export function getFieldSeriesColor(field: Field, theme: GrafanaTheme2): ColorScaleValue {
  const mode = getFieldColorModeForField(field);

  if (!mode.isByValue) {
    return {
      color: mode.getCalculator(field, theme)(0, 0),
      threshold: fallBackThreshold,
      percent: 1,
    };
  }

  const scale = getScaleCalculator(field, theme);
  const stat = field.config.color?.seriesBy ?? 'last';
  const calcs = reduceField({ field, reducers: [stat] });
  const value = calcs[stat] ?? 0;

  return scale(value);
}

function getFixedColor(field: Field, theme: GrafanaTheme2) {
  return () => {
    return theme.visualization.getColorByName(field.config.color?.fixedColor ?? FALLBACK_COLOR);
  };
}

function getShadedColor(field: Field, theme: GrafanaTheme2) {
  return () => {
    const baseColorString: string = theme.visualization.getColorByName(
      field.config.color?.fixedColor ?? FALLBACK_COLOR
    );

    const colors: string[] = [
      baseColorString, // start with base color
    ];

    const shadesCount = 6;
    const maxHueSpin = 10; // hue spin, max is 360
    const maxDarken = 35; // max 100%
    const maxBrighten = 35; // max 100%

    for (let i = 1; i < shadesCount; i++) {
      // push alternating darker and brighter shades
      colors.push(
        tinycolor(baseColorString)
          .spin((i / shadesCount) * maxHueSpin)
          .brighten((i / shadesCount) * maxDarken)
          .toHexString()
      );
      colors.push(
        tinycolor(baseColorString)
          .spin(-(i / shadesCount) * maxHueSpin)
          .darken((i / shadesCount) * maxBrighten)
          .toHexString()
      );
    }

    const seriesIndex = field.state?.seriesIndex ?? 0;
    return colors[seriesIndex % colors.length];
  };
}
