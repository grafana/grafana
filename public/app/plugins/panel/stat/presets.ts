import { FieldColorModeId, VisualizationPresetsSupplier, VisualizationSuggestion, VizOrientation } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  BigValueColorMode,
  BigValueGraphMode,
  BigValueJustifyMode,
  BigValueTextMode,
  GraphFieldConfig,
  PercentChangeColorMode,
} from '@grafana/schema';

import { defaultOptions, Options } from './panelcfg.gen';

/**
 * Threshold value preset - color from thresholds, no sparkline
 */
const thresholdValuePreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => {
  return {
    name: t('stat.presets.threshold-value', 'Threshold value'),
    options: {
      ...defaultOptions,
      orientation: VizOrientation.Auto,
      textMode: BigValueTextMode.Auto,
      wideLayout: true,
      colorMode: BigValueColorMode.Value,
      graphMode: BigValueGraphMode.None,
      justifyMode: BigValueJustifyMode.Auto,
      showPercentChange: false,
      percentChangeColorMode: PercentChangeColorMode.Standard,
    },
    fieldConfig: {
      defaults: {
        color: { mode: FieldColorModeId.Thresholds, fixedColor: '#ad46ff' },
      },
      overrides: [],
    },
    cardOptions: {},
  };
};

/**
 * Threshold value with sparkline preset - color from thresholds, area sparkline
 */
const thresholdValueSparklinePreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => {
  return {
    name: t('stat.presets.threshold-value-sparkline', 'Threshold value with sparkline'),
    options: {
      ...defaultOptions,
      orientation: VizOrientation.Auto,
      textMode: BigValueTextMode.Auto,
      wideLayout: true,
      colorMode: BigValueColorMode.Value,
      graphMode: BigValueGraphMode.Area,
      justifyMode: BigValueJustifyMode.Auto,
      showPercentChange: false,
      percentChangeColorMode: PercentChangeColorMode.Standard,
    },
    fieldConfig: {
      defaults: {
        color: { mode: FieldColorModeId.Thresholds, fixedColor: '#ad46ff' },
      },
      overrides: [],
    },
    cardOptions: {},
  };
};

/**
 * Threshold background preset - background colored from thresholds, no sparkline
 */
const thresholdBackgroundPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => {
  return {
    name: t('stat.presets.threshold-background', 'Threshold background'),
    options: {
      ...defaultOptions,
      orientation: VizOrientation.Auto,
      textMode: BigValueTextMode.Auto,
      wideLayout: true,
      colorMode: BigValueColorMode.Background,
      graphMode: BigValueGraphMode.None,
      justifyMode: BigValueJustifyMode.Auto,
      showPercentChange: false,
      percentChangeColorMode: PercentChangeColorMode.Standard,
    },
    fieldConfig: {
      defaults: {
        color: { mode: FieldColorModeId.Thresholds, fixedColor: '#ad46ff' },
      },
      overrides: [],
    },
    cardOptions: {},
  };
};

/**
 * Threshold background with sparkline preset - background colored from thresholds, area sparkline
 */
const thresholdBackgroundSparklinePreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => {
  return {
    name: t('stat.presets.threshold-background-sparkline', 'Threshold background with sparkline'),
    options: {
      ...defaultOptions,
      orientation: VizOrientation.Auto,
      textMode: BigValueTextMode.Auto,
      wideLayout: true,
      colorMode: BigValueColorMode.Background,
      graphMode: BigValueGraphMode.Area,
      justifyMode: BigValueJustifyMode.Auto,
      showPercentChange: false,
      percentChangeColorMode: PercentChangeColorMode.Standard,
    },
    fieldConfig: {
      defaults: {
        color: { mode: FieldColorModeId.Thresholds, fixedColor: '#ad46ff' },
      },
      overrides: [],
    },
    cardOptions: {},
  };
};

/**
 * Horizontal threshold value preset - horizontal layout, color from thresholds, no sparkline
 */
const horizontalThresholdValuePreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => {
  return {
    name: t('stat.presets.horizontal-threshold-value', 'Horizontal threshold value'),
    // description: t(
    //   'stat.presets.horizontal-threshold-value-desc',
    //   'Color from thresholds, horizontal, no graph'
    // ),
    options: {
      ...defaultOptions,
      orientation: VizOrientation.Horizontal,
      textMode: BigValueTextMode.Auto,
      wideLayout: true,
      colorMode: BigValueColorMode.Value,
      graphMode: BigValueGraphMode.None,
      justifyMode: BigValueJustifyMode.Auto,
      showPercentChange: false,
      percentChangeColorMode: PercentChangeColorMode.Standard,
    },
    fieldConfig: {
      defaults: {
        color: { mode: FieldColorModeId.Thresholds, fixedColor: '#ad46ff' },
      },
      overrides: [],
    },
    cardOptions: {},
  };
};

/**
 * Horizontal threshold value with sparkline preset - horizontal layout, color from thresholds, area sparkline
 */
const horizontalThresholdValueSparklinePreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => {
  return {
    name: t('stat.presets.horizontal-threshold-value-sparkline', 'Horizontal threshold value with sparkline'),
    // description: t(
    //   'stat.presets.horizontal-threshold-value-sparkline-desc',
    //   'Color from thresholds, horizontal'
    // ),
    options: {
      ...defaultOptions,
      orientation: VizOrientation.Horizontal,
      textMode: BigValueTextMode.Auto,
      wideLayout: true,
      colorMode: BigValueColorMode.Value,
      graphMode: BigValueGraphMode.Area,
      justifyMode: BigValueJustifyMode.Auto,
      showPercentChange: false,
      percentChangeColorMode: PercentChangeColorMode.Standard,
    },
    fieldConfig: {
      defaults: {
        color: { mode: FieldColorModeId.Thresholds, fixedColor: '#ad46ff' },
      },
      overrides: [],
    },
    cardOptions: {},
  };
};

/**
 * Wide list preset - horizontal layout, name and value, wide layout, fixed color, area sparkline
 */
const wideListPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => {
  return {
    name: t('stat.presets.wide-list', 'Wide list'),
    // description: t('stat.presets.wide-list-desc', 'Color mode none, text mode value and name, text align center, single color'),
    options: {
      ...defaultOptions,
      orientation: VizOrientation.Horizontal,
      textMode: BigValueTextMode.ValueAndName,
      wideLayout: true,
      colorMode: BigValueColorMode.None,
      graphMode: BigValueGraphMode.Area,
      justifyMode: BigValueJustifyMode.Auto,
      showPercentChange: false,
      percentChangeColorMode: PercentChangeColorMode.Standard,
    },
    fieldConfig: {
      defaults: {
        color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' },
      },
      overrides: [],
    },
    cardOptions: {},
  };
};

/**
 * List preset - horizontal layout, name and value, fixed color, area sparkline
 */
const listPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => {
  return {
    name: t('stat.presets.list', 'List'),
    // description: t('stat.presets.list_desc', 'Color mode none, text mode value and name, text align center, single color'),
    options: {
      ...defaultOptions,
      orientation: VizOrientation.Horizontal,
      textMode: BigValueTextMode.ValueAndName,
      wideLayout: false,
      colorMode: BigValueColorMode.None,
      graphMode: BigValueGraphMode.Area,
      justifyMode: BigValueJustifyMode.Center,
      showPercentChange: false,
      percentChangeColorMode: PercentChangeColorMode.Standard,
    },
    fieldConfig: {
      defaults: {
        color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' },
      },
      overrides: [],
    },
    cardOptions: {},
  };
};

const FEW_SERIES_THRESHOLD = 5;

export const statPresetsSupplier: VisualizationPresetsSupplier<Options, GraphFieldConfig> = ({ dataSummary }) => {
  const frameCount = dataSummary?.frameCount ?? 0;
  const hasSingleSeries = frameCount === 1;
  const hasFewSeries = frameCount > 1 && frameCount < FEW_SERIES_THRESHOLD;

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

  return [];
};
