import { FieldColorModeId, type FieldConfigSource, type VisualizationPresetsSupplier, type VisualizationSuggestion } from '@grafana/data';
import { FieldType } from '@grafana/data/dataframe';
import { t } from '@grafana/i18n';
import { AxisPlacement, GraphGradientMode, StackingMode } from '@grafana/schema';
import { SUGGESTIONS_LEGEND_OPTIONS } from 'app/features/panel/suggestions/utils';

import { type FieldConfig, type Options } from './panelcfg.gen';

const MAX_PREVIEW_ROWS = 20;

const previewModifier = (s: VisualizationSuggestion<Options, FieldConfig>) => {
  s.options!.legend = SUGGESTIONS_LEGEND_OPTIONS;
  s.fieldConfig!.defaults.custom!.axisPlacement = AxisPlacement.Hidden;
  s.options!.barWidth = 0.8;
};

function makePreset(
  preset: Omit<VisualizationSuggestion<Options, FieldConfig>, 'cardOptions'>,
  maxRows?: number
): VisualizationSuggestion<Options, FieldConfig> {
  return { ...preset, cardOptions: { previewModifier, maxRows } };
}

const CLASSIC_CUSTOM: Partial<FieldConfig> = {
  lineWidth: 0,
  fillOpacity: 100,
  gradientMode: GraphGradientMode.None,
};

const HUE_CUSTOM: Partial<FieldConfig> = {
  lineWidth: 1,
  fillOpacity: 100,
  gradientMode: GraphGradientMode.Hue,
};

const CLASSIC_OPTIONS: Partial<Options> = {
  xTickLabelSpacing: 100,
  groupWidth: 0.8,
  barWidth: 0.95,
  barRadius: 0.05,
  xField: 'time',
  stacking: StackingMode.None,
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
  stacking: StackingMode.None,
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

const paletteClassicPreset = (maxRows?: number) =>
  makePreset(
    {
      name: t('barchart.presets.palette-classic', 'Palette classic'),
      options: CLASSIC_OPTIONS,
      fieldConfig: FC_PALETTE_CLASSIC,
    },
    maxRows
  );

const paletteClassicStackedPreset = (maxRows?: number) =>
  makePreset(
    {
      name: t('barchart.presets.palette-classic-stacked', 'Palette classic stacked'),
      options: CLASSIC_STACKED_OPTIONS,
      fieldConfig: FC_PALETTE_CLASSIC,
    },
    maxRows
  );

const fixedPurpleHuePreset = (maxRows?: number) =>
  makePreset(
    {
      name: t('barchart.presets.fixed-purple-hue', 'Fixed purple hue'),
      options: HUE_OPTIONS,
      fieldConfig: FC_FIXED_PURPLE_HUE,
    },
    maxRows
  );

const viridisHuePreset = (maxRows?: number) =>
  makePreset(
    {
      name: t('barchart.presets.viridis-hue', 'Viridis hue'),
      options: HUE_OPTIONS,
      fieldConfig: FC_VIRIDIS_HUE,
    },
    maxRows
  );

export const barchartPresetsSupplier: VisualizationPresetsSupplier<Options, FieldConfig> = ({ dataSummary }) => {
  if (!dataSummary?.hasData || !dataSummary.hasFieldType(FieldType.number)) {
    return [];
  }

  const hasMultipleNumberFields = dataSummary.fieldCountByType(FieldType.number) > 1;
  const rowCountMax = dataSummary.rowCountMax;
  const maxRows = rowCountMax > MAX_PREVIEW_ROWS ? MAX_PREVIEW_ROWS : undefined;

  const presets = [paletteClassicPreset(maxRows), fixedPurpleHuePreset(maxRows), viridisHuePreset(maxRows)];

  if (hasMultipleNumberFields) {
    presets.push(paletteClassicStackedPreset(maxRows));
  }

  return presets;
};
