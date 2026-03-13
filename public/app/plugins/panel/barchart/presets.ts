import {
  FieldColorModeId,
  FieldConfigSource,
  VisualizationPresetsSupplier,
  VisualizationSuggestion,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  AxisColorMode,
  AxisPlacement,
  GraphGradientMode,
  GraphThresholdsStyleMode,
  ScaleDistribution,
  StackingMode,
} from '@grafana/schema';
import { SUGGESTIONS_LEGEND_OPTIONS } from 'app/features/panel/suggestions/utils';

import { FieldConfig, Options } from './panelcfg.gen';

const previewModifier = (s: VisualizationSuggestion<Options, FieldConfig>) => {
  s.options!.legend = SUGGESTIONS_LEGEND_OPTIONS;
  s.fieldConfig!.defaults.custom!.axisPlacement = AxisPlacement.Hidden;
  s.options!.barWidth = 0.8;
};

function makePreset(
  preset: Omit<VisualizationSuggestion<Options, FieldConfig>, 'cardOptions'>
): VisualizationSuggestion<Options, FieldConfig> {
  return { ...preset, cardOptions: { previewModifier } };
}

const SHARED_CUSTOM: Partial<FieldConfig> = {
  lineWidth: 1,
  fillOpacity: 100,
  gradientMode: GraphGradientMode.Hue,
  axisPlacement: AxisPlacement.Auto,
  axisLabel: '',
  axisColorMode: AxisColorMode.Text,
  axisBorderShow: false,
  scaleDistribution: { type: ScaleDistribution.Linear },
  axisCenteredZero: false,
  hideFrom: { tooltip: false, viz: false, legend: false },
  thresholdsStyle: { mode: GraphThresholdsStyleMode.Off },
};

const FC_VIRIDIS_HUE: FieldConfigSource<Partial<FieldConfig>> = {
  defaults: {
    custom: SHARED_CUSTOM,
    color: { mode: FieldColorModeId.ContinuousViridis },
  },
  overrides: [],
};

const FC_FIXED_PURPLE_HUE: FieldConfigSource<Partial<FieldConfig>> = {
  defaults: {
    custom: SHARED_CUSTOM,
    color: { mode: FieldColorModeId.Fixed, fixedColor: '#ad46ff' },
  },
  overrides: [],
};

const FC_FIXED_SLATE_HUE: FieldConfigSource<Partial<FieldConfig>> = {
  defaults: {
    custom: SHARED_CUSTOM,
    color: { mode: FieldColorModeId.Fixed, fixedColor: '#90a1b9' },
  },
  overrides: [],
};

const FC_FIXED_NAVY_HUE: FieldConfigSource<Partial<FieldConfig>> = {
  defaults: {
    custom: SHARED_CUSTOM,
    color: { mode: FieldColorModeId.Fixed, fixedColor: '#314158' },
  },
  overrides: [],
};

// --- Multi series ---

const MULTI_CUSTOM: Partial<FieldConfig> = {
  lineWidth: 0,
  fillOpacity: 100,
  gradientMode: GraphGradientMode.None,
  axisPlacement: AxisPlacement.Auto,
  axisLabel: '',
  axisColorMode: AxisColorMode.Text,
  axisBorderShow: false,
  scaleDistribution: { type: ScaleDistribution.Linear },
  axisCenteredZero: false,
  hideFrom: { tooltip: false, viz: false, legend: false },
  thresholdsStyle: { mode: GraphThresholdsStyleMode.Off },
};

const MULTI_OPTIONS: Partial<Options> = {
  xTickLabelSpacing: 100,
  groupWidth: 0.8,
  barWidth: 0.95,
  barRadius: 0.05,
  xField: 'time',
  stacking: StackingMode.None,
};

const MULTI_STACKED_OPTIONS: Partial<Options> = {
  ...MULTI_OPTIONS,
  stacking: StackingMode.Normal,
};

const FC_PALETTE_CLASSIC: FieldConfigSource<Partial<FieldConfig>> = {
  defaults: {
    custom: MULTI_CUSTOM,
    color: { mode: FieldColorModeId.PaletteClassic },
  },
  overrides: [],
};

const FC_PALETTE_CLASSIC_OPACITY: FieldConfigSource<Partial<FieldConfig>> = {
  defaults: {
    custom: { ...MULTI_CUSTOM, gradientMode: GraphGradientMode.Opacity },
    color: { mode: FieldColorModeId.PaletteClassic },
  },
  overrides: [],
};

// --- Single series presets ---

const viridisHuePreset = () =>
  makePreset({
    name: t('barchart.presets.viridis-hue', 'Viridis hue'),
    // description: t('barchart.presets.viridis-hue-description', 'Solid bars with viridis color scheme and hue gradient'),
    fieldConfig: FC_VIRIDIS_HUE,
  });

const fixedPurpleHuePreset = () =>
  makePreset({
    name: t('barchart.presets.fixed-purple-hue', 'Fixed purple hue'),
    // description: t('barchart.presets.fixed-purple-hue-description', 'Solid bars with a fixed purple color and hue gradient'),
    fieldConfig: FC_FIXED_PURPLE_HUE,
  });

const fixedSlateHuePreset = () =>
  makePreset({
    name: t('barchart.presets.fixed-slate-hue', 'Fixed slate hue'),
    // description: t('barchart.presets.fixed-slate-hue-description', 'Solid bars with a fixed slate color and hue gradient'),
    fieldConfig: FC_FIXED_SLATE_HUE,
  });

const fixedNavyHuePreset = () =>
  makePreset({
    name: t('barchart.presets.fixed-navy-hue', 'Fixed navy hue'),
    // description: t('barchart.presets.fixed-navy-hue-description', 'Solid bars with a fixed navy color and hue gradient'),
    fieldConfig: FC_FIXED_NAVY_HUE,
  });

// --- Multi series presets ---

const paletteClassicPreset = () =>
  makePreset({
    name: t('barchart.presets.palette-classic', 'Palette classic'),
    // description: t('barchart.presets.palette-classic-description', 'Grouped bars with classic palette colors and no gradient'),
    options: MULTI_OPTIONS,
    fieldConfig: FC_PALETTE_CLASSIC,
  });

const paletteClassicOpacityPreset = () =>
  makePreset({
    name: t('barchart.presets.palette-classic-opacity', 'Palette classic opacity'),
    // description: t('barchart.presets.palette-classic-opacity-description', 'Grouped bars with classic palette colors and opacity gradient'),
    options: MULTI_OPTIONS,
    fieldConfig: FC_PALETTE_CLASSIC_OPACITY,
  });

const paletteClassicStackedPreset = () =>
  makePreset({
    name: t('barchart.presets.palette-classic-stacked', 'Palette classic stacked'),
    // description: t('barchart.presets.palette-classic-stacked-description', 'Stacked bars with classic palette colors and no gradient'),
    options: MULTI_STACKED_OPTIONS,
    fieldConfig: FC_PALETTE_CLASSIC,
  });

const paletteClassicStackedOpacityPreset = () =>
  makePreset({
    name: t('barchart.presets.palette-classic-stacked-opacity', 'Palette classic stacked opacity'),
    // description: t('barchart.presets.palette-classic-stacked-opacity-description', 'Stacked bars with classic palette colors and opacity gradient'),
    options: MULTI_STACKED_OPTIONS,
    fieldConfig: FC_PALETTE_CLASSIC_OPACITY,
  });

export const barchartPresetsSupplier: VisualizationPresetsSupplier<Options, FieldConfig> = ({ dataSummary }) => {
  const frameCount = dataSummary?.frameCount ?? 0;
  const hasSingleSeries = frameCount === 1;

  if (hasSingleSeries) {
    return [viridisHuePreset(), fixedPurpleHuePreset(), fixedSlateHuePreset(), fixedNavyHuePreset()];
  }

  return [
    paletteClassicPreset(),
    paletteClassicOpacityPreset(),
    paletteClassicStackedPreset(),
    paletteClassicStackedOpacityPreset(),
  ];
};
