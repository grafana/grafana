import { FieldColorModeId, VisualizationPresetsSupplier, VisualizationSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { GraphFieldConfig } from '@grafana/ui';

import { defaultOptions, Options } from '../panelcfg.gen';

/**
 * Default preset - resets visual options to default and restores threshold-based color mode
 */
const defaultPreset = (
  context: Parameters<VisualizationPresetsSupplier<Options, GraphFieldConfig>>[0]
): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('gauge.presets.default', 'Default'),
  options: defaultOptions,
  fieldConfig: {
    defaults: {
      color: { mode: FieldColorModeId.Thresholds },
      ...(context.fieldConfig?.defaults?.thresholds ? { thresholds: context.fieldConfig.defaults.thresholds } : {}),
    },
    overrides: [],
  },
  cardOptions: {},
});

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
  return [
    defaultPreset(context),
    glowPreset(),
    segmentedPreset(),
    thresholdPreset(),
    spotlightPreset(),
    blocksPreset(),
  ];
};
