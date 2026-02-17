import { defaultsDeep } from 'lodash';

import { PresetsSupplierContext, VisualizationSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import { GraphFieldConfig, GraphGradientMode, LineInterpolation, VisibilityMode } from '@grafana/schema';
import { SUGGESTIONS_LEGEND_OPTIONS } from 'app/features/panel/suggestions/utils';

import { Options } from './panelcfg.gen';

const withDefaults = (
  preset: VisualizationSuggestion<Options, GraphFieldConfig>
): VisualizationSuggestion<Options, GraphFieldConfig> =>
  defaultsDeep(preset, {
    fieldConfig: {
      defaults: {
        custom: {},
      },
      overrides: [],
    },
    cardOptions: {
      previewModifier: (p: VisualizationSuggestion<Options, GraphFieldConfig>) => {
        p.options!.disableKeyboardEvents = true;
        p.options!.legend = SUGGESTIONS_LEGEND_OPTIONS;
      },
    },
  });

/**
 * Creates the default preset using the current panel's configuration
 * Captures the exact styling of the current panel
 */
const defaultPreset = (
  context: PresetsSupplierContext<Options, GraphFieldConfig>
): VisualizationSuggestion<Options, GraphFieldConfig> => {
  const currentCustom = context.fieldConfig?.defaults?.custom;
  const currentColor = context.fieldConfig?.defaults?.color;

  return {
    name: t('timeseries.presets.default', 'Default'),
    fieldConfig: {
      defaults: {
        custom: currentCustom,
        color: currentColor,
      },
      overrides: [],
    },
  };
};

/**
 * Smooth preset with visible points - TS3
 */
const smoothPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('timeseries.presets.smooth', 'Smooth'),
  fieldConfig: {
    defaults: {
      custom: {
        lineWidth: 1,
        fillOpacity: 24,
        gradientMode: GraphGradientMode.Opacity,
        lineInterpolation: LineInterpolation.Smooth,
        showPoints: VisibilityMode.Always,
        pointSize: 6,
      },
    },
    overrides: [],
  },
});

/**
 * Area chart preset with no line border -TS6
 */
const areaPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('timeseries.presets.area', 'Area'),
  fieldConfig: {
    defaults: {
      custom: {
        lineWidth: 0,
        fillOpacity: 100,
        gradientMode: GraphGradientMode.Opacity,
        lineInterpolation: LineInterpolation.Smooth,
        showPoints: VisibilityMode.Auto,
        pointSize: 4,
      },
    },
    overrides: [],
  },
});

/**
 * Step chart preset - TS4
 */
const stepPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('timeseries.presets.step', 'Step'),
  fieldConfig: {
    defaults: {
      custom: {
        lineWidth: 1,
        fillOpacity: 0,
        gradientMode: GraphGradientMode.Opacity,
        lineInterpolation: LineInterpolation.StepBefore,
        showPoints: VisibilityMode.Auto,
        pointSize: 1,
      },
    },
    overrides: [],
  },
});

/**
 * Step chart with fill preset - TS5
 */
const stepFilledPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('timeseries.presets.step-filled', 'Step filled'),
  fieldConfig: {
    defaults: {
      custom: {
        lineWidth: 1,
        fillOpacity: 45,
        gradientMode: GraphGradientMode.Opacity,
        lineInterpolation: LineInterpolation.StepBefore,
        showPoints: VisibilityMode.Auto,
        pointSize: 1,
      },
    },
    overrides: [],
  },
});

/**
 * Step chart with hue gradient preset - TS5hue
 */
const stepHuePreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('timeseries.presets.step-hue', 'Step hue'),
  fieldConfig: {
    defaults: {
      custom: {
        lineWidth: 1,
        fillOpacity: 45,
        gradientMode: GraphGradientMode.Hue,
        lineInterpolation: LineInterpolation.StepBefore,
        showPoints: VisibilityMode.Auto,
        pointSize: 1,
      },
    },
    overrides: [],
  },
});

export const timeseriesPresetsSupplier = (
  context: PresetsSupplierContext<Options, GraphFieldConfig>
): Array<VisualizationSuggestion<Options, GraphFieldConfig>> | void => {
  const presets: Array<VisualizationSuggestion<Options, GraphFieldConfig>> = [
    defaultPreset(context),
    smoothPreset(),
    areaPreset(),
    stepPreset(),
    stepFilledPreset(),
    stepHuePreset(),
  ];

  return presets.map((p) => withDefaults(p));
};
