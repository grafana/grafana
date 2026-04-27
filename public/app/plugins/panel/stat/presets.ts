import { FieldColorModeId, type FieldConfigSource, type VisualizationPresetsSupplier, type VisualizationSuggestion, VizOrientation } from '@grafana/data';
import { FieldType } from '@grafana/data/dataframe';
import { t } from '@grafana/i18n';
import {
  BigValueColorMode,
  BigValueGraphMode,
  BigValueJustifyMode,
  BigValueTextMode,
  type GraphFieldConfig,
  PercentChangeColorMode,
} from '@grafana/schema';

import { defaultOptions, type Options } from './panelcfg.gen';

const MAX_PREVIEW_SERIES = 6;

const PRESET_CARD_OPTIONS: VisualizationSuggestion<Options, GraphFieldConfig>['cardOptions'] = {
  maxSeries: MAX_PREVIEW_SERIES,
  previewModifier: (s) => {
    if (s.options?.reduceOptions?.values) {
      s.options.reduceOptions.limit = MAX_PREVIEW_SERIES;
    }
  },
};

const makePreset = (
  preset: Omit<VisualizationSuggestion<Options, GraphFieldConfig>, 'cardOptions'>
): VisualizationSuggestion<Options, GraphFieldConfig> => {
  return { ...preset, cardOptions: PRESET_CARD_OPTIONS };
};

const BASE_OPTIONS = {
  ...defaultOptions,
  textMode: BigValueTextMode.Auto,
  wideLayout: true,
  justifyMode: BigValueJustifyMode.Auto,
  showPercentChange: false,
  percentChangeColorMode: PercentChangeColorMode.Standard,
};

const AUTO_OPTIONS = {
  ...BASE_OPTIONS,
  orientation: VizOrientation.Auto,
};

const HORIZONTAL_OPTIONS = {
  ...BASE_OPTIONS,
  orientation: VizOrientation.Horizontal,
};

const THRESHOLD_FIELD_CONFIG: FieldConfigSource<Partial<GraphFieldConfig>> = {
  defaults: {
    color: { mode: FieldColorModeId.Thresholds, fixedColor: '#ad46ff' },
  },
  overrides: [],
};

const FIXED_BLUE_FIELD_CONFIG: FieldConfigSource<Partial<GraphFieldConfig>> = {
  defaults: {
    color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' },
  },
  overrides: [],
};

// --- Single series presets ---

/**
 * Threshold value preset - color from thresholds, no sparkline
 */
const thresholdValuePreset = () =>
  makePreset({
    name: t('stat.presets.threshold-value', 'Threshold value'),
    description: t('stat.presets.threshold-value-desc', 'Value color from thresholds, no sparkline'),
    options: {
      ...AUTO_OPTIONS,
      colorMode: BigValueColorMode.Value,
      graphMode: BigValueGraphMode.None,
    },
    fieldConfig: THRESHOLD_FIELD_CONFIG,
  });

/**
 * Threshold value with sparkline preset - color from thresholds, area sparkline
 */
const thresholdValueSparklinePreset = () =>
  makePreset({
    name: t('stat.presets.threshold-value-sparkline', 'Threshold value with sparkline'),
    description: t('stat.presets.threshold-value-sparkline-desc', 'Value color from thresholds, area sparkline'),
    options: {
      ...AUTO_OPTIONS,
      colorMode: BigValueColorMode.Value,
      graphMode: BigValueGraphMode.Area,
    },
    fieldConfig: THRESHOLD_FIELD_CONFIG,
  });

/**
 * Threshold background preset - background colored from thresholds, no sparkline
 */
const thresholdBackgroundPreset = () =>
  makePreset({
    name: t('stat.presets.threshold-background', 'Threshold background'),
    description: t('stat.presets.threshold-background-desc', 'Background color from thresholds, no sparkline'),
    options: {
      ...AUTO_OPTIONS,
      colorMode: BigValueColorMode.Background,
      graphMode: BigValueGraphMode.None,
    },
    fieldConfig: THRESHOLD_FIELD_CONFIG,
  });

/**
 * Threshold background with sparkline preset - background colored from thresholds, area sparkline
 */
const thresholdBackgroundSparklinePreset = () =>
  makePreset({
    name: t('stat.presets.threshold-background-sparkline', 'Threshold background with sparkline'),
    description: t(
      'stat.presets.threshold-background-sparkline-desc',
      'Background color from thresholds, area sparkline'
    ),
    options: {
      ...AUTO_OPTIONS,
      colorMode: BigValueColorMode.Background,
      graphMode: BigValueGraphMode.Area,
    },
    fieldConfig: THRESHOLD_FIELD_CONFIG,
  });

/**
 * Wide list preset - horizontal layout, name and value, wide layout, fixed color, area sparkline
 */
const wideListPreset = () =>
  makePreset({
    name: t('stat.presets.wide-list', 'Wide list'),
    description: t('stat.presets.wide-list-desc', 'Horizontal, name and value, area sparkline, single color'),
    options: {
      ...HORIZONTAL_OPTIONS,
      textMode: BigValueTextMode.ValueAndName,
      colorMode: BigValueColorMode.None,
      graphMode: BigValueGraphMode.Area,
    },
    fieldConfig: FIXED_BLUE_FIELD_CONFIG,
  });

/**
 * List preset - horizontal layout, name and value, fixed color, area sparkline
 */
const listPreset = () =>
  makePreset({
    name: t('stat.presets.list', 'List'),
    description: t('stat.presets.list_desc', 'Compact horizontal list, centered, name and value, sparkline'),
    options: {
      ...HORIZONTAL_OPTIONS,
      textMode: BigValueTextMode.ValueAndName,
      wideLayout: false,
      colorMode: BigValueColorMode.None,
      graphMode: BigValueGraphMode.Area,
      justifyMode: BigValueJustifyMode.Center,
    },
    fieldConfig: FIXED_BLUE_FIELD_CONFIG,
  });

// --- Few series presets ---

/**
 * Horizontal threshold value preset - horizontal layout, color from thresholds, no sparkline
 */
const horizontalThresholdValuePreset = () =>
  makePreset({
    name: t('stat.presets.horizontal-threshold-value', 'Horizontal threshold value'),
    description: t(
      'stat.presets.horizontal-threshold-value-desc',
      'Horizontal, value color from thresholds, no sparkline'
    ),
    options: {
      ...HORIZONTAL_OPTIONS,
      colorMode: BigValueColorMode.Value,
      graphMode: BigValueGraphMode.None,
    },
    fieldConfig: THRESHOLD_FIELD_CONFIG,
  });

/**
 * Horizontal threshold value with sparkline preset - horizontal layout, color from thresholds, area sparkline
 */
const horizontalThresholdValueSparklinePreset = () =>
  makePreset({
    name: t('stat.presets.horizontal-threshold-value-sparkline', 'Horizontal threshold value with sparkline'),
    description: t(
      'stat.presets.horizontal-threshold-value-sparkline-desc',
      'Horizontal, value color from thresholds, area sparkline'
    ),
    options: {
      ...HORIZONTAL_OPTIONS,
      colorMode: BigValueColorMode.Value,
      graphMode: BigValueGraphMode.Area,
    },
    fieldConfig: THRESHOLD_FIELD_CONFIG,
  });

const FEW_SERIES_THRESHOLD = 5;

export const statPresetsSupplier: VisualizationPresetsSupplier<Options, GraphFieldConfig> = ({ dataSummary }) => {
  if (!dataSummary?.hasData || !dataSummary.hasFieldType(FieldType.number)) {
    return [];
  }

  const frameCount = dataSummary.frameCount;
  const hasSingleSeries = frameCount === 1;
  const hasFewSeries = frameCount > 1 && frameCount < FEW_SERIES_THRESHOLD;
  const hasMultiSeries = frameCount >= FEW_SERIES_THRESHOLD;

  if (hasSingleSeries) {
    return [
      thresholdValuePreset(),
      thresholdValueSparklinePreset(),
      thresholdBackgroundPreset(),
      thresholdBackgroundSparklinePreset(),
      wideListPreset(),
      listPreset(),
    ];
  }

  if (hasFewSeries) {
    return [
      horizontalThresholdValuePreset(),
      horizontalThresholdValueSparklinePreset(),
      thresholdBackgroundSparklinePreset(),
    ];
  }

  if (hasMultiSeries) {
    return [
      thresholdValueSparklinePreset(),
      thresholdBackgroundPreset(),
      thresholdValuePreset(),
      thresholdBackgroundSparklinePreset(),
    ];
  }

  return [];
};
