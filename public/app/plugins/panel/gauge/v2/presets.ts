import {
  FieldColorModeId,
  VisualizationPresetsContext,
  VisualizationPresetsSupplier,
  VisualizationSuggestion,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { GraphFieldConfig } from '@grafana/ui';

import { defaultOptions, Options } from '../panelcfg.gen';

/**
 * Default preset - resets visual options to default, preserves the current shape, and restores threshold-based color mode
 */
const defaultPreset = (context: VisualizationPresetsContext): VisualizationSuggestion<Options, GraphFieldConfig> => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const currentOptions = context.options as Options | undefined;
  return {
    name: t('gauge.presets.default', 'Default'),
    options: {
      ...defaultOptions,
      ...(currentOptions?.shape && { shape: currentOptions.shape }),
    },
    fieldConfig: {
      defaults: {
        color: { mode: FieldColorModeId.Thresholds },
      },
      overrides: [],
    },
    cardOptions: {},
  };
};

/**
 * Glow preset - rounded bar with glow endpoint, bar glow + gradient effects, continuous-magma color scheme
 */
const glowPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('gauge.presets.glow', 'Glow'),
  options: {
    shape: 'gauge',
    barWidthFactor: 0.3,
    segmentCount: 1,
    barShape: 'rounded',
    endpointMarker: 'glow',
    sparkline: true,
    showThresholdMarkers: false,
    showThresholdLabels: false,
    effects: {
      barGlow: true,
      centerGlow: false,
      gradient: true,
    },
  },
  fieldConfig: {
    defaults: {
      color: { mode: FieldColorModeId.ContinuousMagma },
    },
    overrides: [],
  },
  cardOptions: {},
});

/**
 * Segmented preset - 24 thin rounded segments with bar glow + gradient effects, continuous-magma color scheme
 */
const segmentedPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('gauge.presets.segmented', 'Segmented'),
  options: {
    shape: 'gauge',
    barWidthFactor: 0.1,
    segmentCount: 24,
    segmentSpacing: 0.1,
    barShape: 'rounded',
    endpointMarker: 'point',
    sparkline: true,
    showThresholdMarkers: false,
    showThresholdLabels: false,
    effects: {
      barGlow: true,
      centerGlow: false,
      gradient: true,
    },
  },
  fieldConfig: {
    defaults: {
      color: { mode: FieldColorModeId.ContinuousMagma },
    },
    overrides: [],
  },
  cardOptions: {},
});

/**
 * Threshold preset - wide flat bar with gradient and Blue-Yellow-Red continuous color scheme
 */
const thresholdPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('gauge.presets.threshold', 'Threshold'),
  options: {
    shape: 'gauge',
    barWidthFactor: 0.54,
    segmentCount: 1,
    barShape: 'flat',
    endpointMarker: 'point',
    sparkline: true,
    showThresholdMarkers: false,
    showThresholdLabels: false,
    effects: {
      barGlow: false,
      centerGlow: false,
      gradient: true,
    },
  },
  fieldConfig: {
    defaults: {
      color: { mode: 'continuous-BlYlRd' },
    },
    overrides: [],
  },
  cardOptions: {},
});

/**
 * Spotlight preset - all effects on, fixed blue color, value+name text mode, no sparkline
 */
const spotlightPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('gauge.presets.spotlight', 'Spotlight'),
  options: {
    shape: 'gauge',
    barWidthFactor: 0.3,
    segmentCount: 1,
    barShape: 'rounded',
    endpointMarker: 'point',
    textMode: 'value_and_name',
    sparkline: false,
    showThresholdMarkers: false,
    showThresholdLabels: false,
    effects: {
      barGlow: true,
      centerGlow: true,
      gradient: true,
    },
  },
  fieldConfig: {
    defaults: {
      color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' },
    },
    overrides: [],
  },
  cardOptions: {},
});

/**
 * Circle Glow preset - full circle shape, rounded bar with glow endpoint, bar glow + gradient effects, continuous-magma color scheme
 */
const circleGlowPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('gauge.presets.circle-glow', 'Circle Glow'),
  options: {
    shape: 'circle',
    barWidthFactor: 0.3,
    segmentCount: 1,
    barShape: 'rounded',
    endpointMarker: 'glow',
    sparkline: true,
    showThresholdMarkers: false,
    showThresholdLabels: false,
    effects: {
      barGlow: true,
      centerGlow: false,
      gradient: true,
    },
  },
  fieldConfig: {
    defaults: {
      color: { mode: FieldColorModeId.ContinuousMagma },
    },
    overrides: [],
  },
  cardOptions: {},
});

/**
 * Circle Segmented preset - full circle shape, 24 thin rounded segments with bar glow + gradient effects, continuous-magma color scheme
 */
const circleSegmentedPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('gauge.presets.circle-segmented', 'Circle Segmented'),
  options: {
    shape: 'circle',
    barWidthFactor: 0.1,
    segmentCount: 24,
    segmentSpacing: 0.1,
    barShape: 'rounded',
    endpointMarker: 'point',
    sparkline: true,
    showThresholdMarkers: false,
    showThresholdLabels: false,
    effects: {
      barGlow: true,
      centerGlow: false,
      gradient: true,
    },
  },
  fieldConfig: {
    defaults: {
      color: { mode: FieldColorModeId.ContinuousMagma },
    },
    overrides: [],
  },
  cardOptions: {},
});

/**
 * Circle Spotlight preset - full circle shape, all effects on, fixed blue color, value+name text mode, no sparkline
 */
const circleSpotlightPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('gauge.presets.circle-spotlight', 'Circle Spotlight'),
  options: {
    shape: 'circle',
    barWidthFactor: 0.3,
    segmentCount: 1,
    barShape: 'rounded',
    endpointMarker: 'point',
    textMode: 'value_and_name',
    sparkline: false,
    showThresholdMarkers: false,
    showThresholdLabels: false,
    effects: {
      barGlow: true,
      centerGlow: true,
      gradient: true,
    },
  },
  fieldConfig: {
    defaults: {
      color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' },
    },
    overrides: [],
  },
  cardOptions: {},
});

/**
 * Circle preset - full circle shape, wide rounded bar with gradient and Blue-Yellow-Red continuous color scheme
 */
const circlePreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('gauge.presets.circle', 'Circle'),
  options: {
    shape: 'circle',
    barWidthFactor: 0.54,
    segmentCount: 1,
    barShape: 'flat',
    endpointMarker: 'point',
    sparkline: true,
    showThresholdMarkers: false,
    showThresholdLabels: false,
    effects: {
      barGlow: false,
      centerGlow: false,
      gradient: true,
    },
  },
  fieldConfig: {
    defaults: {
      color: { mode: 'continuous-BlYlRd' },
    },
    overrides: [],
  },
  cardOptions: {},
});

/**
 * Circle Blocks preset - full circle shape, 24 flat segments with gradient and Blue-Yellow-Red continuous color scheme, no sparkline or glow
 */
const circleBlocksPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('gauge.presets.circle-blocks', 'Circle Blocks'),
  options: {
    shape: 'circle',
    barWidthFactor: 0.1,
    segmentCount: 24,
    segmentSpacing: 0.16,
    barShape: 'flat',
    endpointMarker: 'point',
    sparkline: false,
    showThresholdMarkers: false,
    showThresholdLabels: false,
    effects: {
      barGlow: false,
      centerGlow: false,
      gradient: true,
    },
  },
  fieldConfig: {
    defaults: {
      color: { mode: 'continuous-BlYlRd' },
    },
    overrides: [],
  },
  cardOptions: {},
});

/**
 * Blocks preset - 24 flat segments with gradient and Blue-Yellow-Red continuous color scheme, no sparkline or glow
 */
const blocksPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('gauge.presets.blocks', 'Blocks'),
  options: {
    shape: 'gauge',
    barWidthFactor: 0.1,
    segmentCount: 24,
    segmentSpacing: 0.16,
    barShape: 'flat',
    endpointMarker: 'point',
    sparkline: false,
    showThresholdMarkers: false,
    showThresholdLabels: false,
    effects: {
      barGlow: false,
      centerGlow: false,
      gradient: true,
    },
  },
  fieldConfig: {
    defaults: {
      color: { mode: 'continuous-BlYlRd' },
    },
    overrides: [],
  },
  cardOptions: {},
});

export const gaugePresetsSupplier: VisualizationPresetsSupplier<Options, GraphFieldConfig> = (context) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const currentOptions = context.options as Options | undefined;

  if (currentOptions?.shape === 'circle') {
    return [
      defaultPreset(context),
      circlePreset(),
      circleGlowPreset(),
      circleSegmentedPreset(),
      circleSpotlightPreset(),
      circleBlocksPreset(),
    ];
  }

  // gauge
  return [
    defaultPreset(context),
    glowPreset(),
    segmentedPreset(),
    thresholdPreset(),
    spotlightPreset(),
    blocksPreset(),
  ];
};
