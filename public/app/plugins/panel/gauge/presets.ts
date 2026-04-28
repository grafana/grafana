import {
  FieldColorModeId,
  FieldType,
  ThresholdsMode,
  type VisualizationPresetsSupplier,
  type VisualizationSuggestion,
  VizOrientation,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { BarGaugeSizing } from '@grafana/schema';
import type { GraphFieldConfig } from '@grafana/ui/types';

import { defaultOptions, type Options } from './panelcfg.gen';

/**
 * Standard preset - gauge shape with thresholds
 */
const defaultPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => {
  return {
    name: t('gauge.presets.standard', 'Standard'),
    description: t('gauge.presets.standard_desc', 'Arc gauge, threshold color, with sparkline'),
    options: {
      ...defaultOptions,
      shape: 'gauge',
      orientation: VizOrientation.Auto,
      sizing: BarGaugeSizing.Auto,
      minVizWidth: 75,
      minVizHeight: 75,
      barWidthFactor: 0.54,
      segmentCount: 1,
      segmentSpacing: 0.3,
      barShape: 'flat',
      endpointMarker: 'point',
      textMode: 'auto',
      sparkline: true,
      showThresholdMarkers: true,
      showThresholdLabels: false,
      effects: {
        barGlow: false,
        centerGlow: false,
        gradient: false,
      },
    },
    fieldConfig: {
      defaults: {
        thresholds: {
          mode: ThresholdsMode.Percentage,
          steps: [
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            { value: null as unknown as number, color: 'green' },
            { value: 60, color: '#EAB839' },
            { value: 80, color: 'red' },
          ],
        },
        color: { mode: FieldColorModeId.Thresholds },
      },
      overrides: [],
    },
    cardOptions: {},
  };
};

/**
 * Segmented preset - same as Standard but with 63 segments for a dashed arc appearance
 */
const segmentedPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => {
  return {
    name: t('gauge.presets.segmented', 'Segmented'),
    description: t('gauge.presets.segmented_desc', 'Dashed arc, threshold color, with sparkline'),
    options: {
      ...defaultOptions,
      shape: 'gauge',
      orientation: VizOrientation.Auto,
      sizing: BarGaugeSizing.Auto,
      minVizWidth: 75,
      minVizHeight: 75,
      barWidthFactor: 0.54,
      segmentCount: 63,
      segmentSpacing: 0.3,
      barShape: 'flat',
      endpointMarker: 'point',
      textMode: 'auto',
      sparkline: true,
      showThresholdMarkers: true,
      showThresholdLabels: false,
      effects: {
        barGlow: false,
        centerGlow: false,
        gradient: false,
      },
    },
    fieldConfig: {
      defaults: {
        thresholds: {
          mode: ThresholdsMode.Percentage,
          steps: [
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            { value: null as unknown as number, color: 'green' },
            { value: 60, color: '#EAB839' },
            { value: 80, color: 'red' },
          ],
        },
        color: { mode: FieldColorModeId.Thresholds },
      },
      overrides: [],
    },
    cardOptions: {},
  };
};

/**
 * Gradient preset - same as Standard but with gradient effect and continuous green-yellow-red color scheme
 */
const gradientPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => {
  return {
    name: t('gauge.presets.gradient', 'Gradient'),
    description: t('gauge.presets.gradient_desc', 'Arc gauge, green-yellow-red gradient fill'),
    options: {
      ...defaultOptions,
      shape: 'gauge',
      orientation: VizOrientation.Auto,
      sizing: BarGaugeSizing.Auto,
      minVizWidth: 75,
      minVizHeight: 75,
      barWidthFactor: 0.54,
      segmentCount: 1,
      segmentSpacing: 0.3,
      barShape: 'flat',
      endpointMarker: 'point',
      textMode: 'auto',
      sparkline: true,
      showThresholdMarkers: true,
      showThresholdLabels: false,
      effects: {
        barGlow: false,
        centerGlow: false,
        gradient: true,
      },
    },
    fieldConfig: {
      defaults: {
        color: { mode: FieldColorModeId.ContinuousGrYlRd },
      },
      overrides: [],
    },
    cardOptions: {},
  };
};

/**
 * Circle preset - full-circle shape with percentage-based traffic-light thresholds and no gradient effect
 */
const circlePreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => {
  return {
    name: t('gauge.presets.circle', 'Circle'),
    description: t('gauge.presets.circle_desc', 'Full circle, threshold color, with sparkline'),
    options: {
      ...defaultOptions,
      shape: 'circle',
      orientation: VizOrientation.Auto,
      sizing: BarGaugeSizing.Auto,
      minVizWidth: 75,
      minVizHeight: 75,
      barWidthFactor: 0.54,
      segmentCount: 1,
      segmentSpacing: 0.3,
      barShape: 'flat',
      endpointMarker: 'point',
      textMode: 'auto',
      sparkline: true,
      showThresholdMarkers: true,
      showThresholdLabels: false,
      effects: {
        barGlow: false,
        centerGlow: false,
        gradient: false,
      },
    },
    fieldConfig: {
      defaults: {
        thresholds: {
          mode: ThresholdsMode.Percentage,
          steps: [
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            { value: null as unknown as number, color: 'green' },
            { value: 60, color: '#EAB839' },
            { value: 80, color: 'red' },
          ],
        },
        color: { mode: FieldColorModeId.Thresholds },
      },
      overrides: [],
    },
    cardOptions: {},
  };
};

/**
 * Neon preset - circle shape with rounded bar, glow effects, and a fixed red color
 */
const neonPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => {
  return {
    name: t('gauge.presets.neon', 'Neon'),
    description: t('gauge.presets.neon_desc', 'Circle, rounded bar, glow effects, fixed red'),
    options: {
      ...defaultOptions,
      shape: 'circle',
      orientation: VizOrientation.Auto,
      sizing: BarGaugeSizing.Auto,
      minVizWidth: 75,
      minVizHeight: 75,
      barWidthFactor: 0.25,
      segmentCount: 1,
      segmentSpacing: 0.3,
      barShape: 'rounded',
      endpointMarker: 'glow',
      textMode: 'auto',
      sparkline: true,
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
        color: { mode: FieldColorModeId.Fixed, fixedColor: 'red' },
      },
      overrides: [],
    },
    cardOptions: {},
  };
};

/**
 * Neon segmented preset - circle with 10 rounded segments, glow effects, and a fixed blue color
 */
const neonSegmentedPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => {
  return {
    name: t('gauge.presets.neonSegmented', 'Neon segmented'),
    description: t('gauge.presets.neonSegmented_desc', 'Circle, 10 rounded segments, glow effects, fixed blue'),
    options: {
      ...defaultOptions,
      shape: 'circle',
      orientation: VizOrientation.Auto,
      sizing: BarGaugeSizing.Auto,
      minVizWidth: 75,
      minVizHeight: 75,
      barWidthFactor: 0.25,
      segmentCount: 10,
      segmentSpacing: 0.15,
      barShape: 'rounded',
      endpointMarker: 'glow',
      textMode: 'auto',
      sparkline: true,
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
  };
};

export const gaugePresetsSupplier: VisualizationPresetsSupplier<Options, GraphFieldConfig> = ({ dataSummary }) => {
  if (!dataSummary?.hasData || !dataSummary.hasFieldType(FieldType.number)) {
    return [];
  }

  return [defaultPreset(), segmentedPreset(), gradientPreset(), circlePreset(), neonPreset(), neonSegmentedPreset()];
};
