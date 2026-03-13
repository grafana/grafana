import {
  FieldColorModeId,
  FieldConfigSource,
  FieldType,
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

const BASE_CUSTOM: Partial<FieldConfig> = {
  fillOpacity: 100,
  axisPlacement: AxisPlacement.Auto,
  axisLabel: '',
  axisColorMode: AxisColorMode.Text,
  axisBorderShow: false,
  scaleDistribution: { type: ScaleDistribution.Linear },
  axisCenteredZero: false,
  hideFrom: { tooltip: false, viz: false, legend: false },
  thresholdsStyle: { mode: GraphThresholdsStyleMode.Off },
};

const CLASSIC_CUSTOM: Partial<FieldConfig> = {
  ...BASE_CUSTOM,
  lineWidth: 0,
  gradientMode: GraphGradientMode.None,
};

const HUE_CUSTOM: Partial<FieldConfig> = {
  ...BASE_CUSTOM,
  lineWidth: 1,
  gradientMode: GraphGradientMode.Hue,
};

const CLASSIC_OPTIONS: Partial<Options> = {
  xTickLabelSpacing: 100,
  groupWidth: 0.8,
  barWidth: 0.95,
  barRadius: 0.05,
  xField: 'time',
};

const CLASSIC_STACKED_OPTIONS: Partial<Options> = {
  ...CLASSIC_OPTIONS,
  stacking: StackingMode.Normal,
};

const HUE_OPTIONS: Partial<Options> = {
  xTickLabelSpacing: 100,
  groupWidth: 0.8,
  barWidth: 0.9,
  barRadius: 0,
  xField: 'time',
};

const FC_PALETTE_CLASSIC: FieldConfigSource<Partial<FieldConfig>> = {
  defaults: {
    custom: CLASSIC_CUSTOM,
    color: { mode: FieldColorModeId.PaletteClassic },
  },
  overrides: [],
};

const FC_FIXED_PURPLE_HUE: FieldConfigSource<Partial<FieldConfig>> = {
  defaults: {
    custom: HUE_CUSTOM,
    color: { mode: FieldColorModeId.Fixed, fixedColor: '#ad46ff' },
  },
  overrides: [],
};

const FC_VIRIDIS_HUE: FieldConfigSource<Partial<FieldConfig>> = {
  defaults: {
    custom: HUE_CUSTOM,
    color: { mode: FieldColorModeId.ContinuousViridis },
  },
  overrides: [],
};

const paletteClassicPreset = () =>
  makePreset({
    name: t('barchart.presets.palette-classic', 'Palette classic'),
    options: CLASSIC_OPTIONS,
    fieldConfig: FC_PALETTE_CLASSIC,
  });

const paletteClassicStackedPreset = () =>
  makePreset({
    name: t('barchart.presets.palette-classic-stacked', 'Palette classic stacked'),
    options: CLASSIC_STACKED_OPTIONS,
    fieldConfig: FC_PALETTE_CLASSIC,
  });

const fixedPurpleHuePreset = () =>
  makePreset({
    name: t('barchart.presets.fixed-purple-hue', 'Fixed purple hue'),
    options: HUE_OPTIONS,
    fieldConfig: FC_FIXED_PURPLE_HUE,
  });

const viridisHuePreset = () =>
  makePreset({
    name: t('barchart.presets.viridis-hue', 'Viridis hue'),
    options: HUE_OPTIONS,
    fieldConfig: FC_VIRIDIS_HUE,
  });

export const barchartPresetsSupplier: VisualizationPresetsSupplier<Options, FieldConfig> = ({ dataSummary }) => {
  const hasMultipleNumberFields = (dataSummary?.fieldCountByType(FieldType.number) ?? 0) > 1;
  const presets = [paletteClassicPreset(), fixedPurpleHuePreset(), viridisHuePreset()];

  if (hasMultipleNumberFields) {
    presets.push(paletteClassicStackedPreset());
  }

  return presets;
};
