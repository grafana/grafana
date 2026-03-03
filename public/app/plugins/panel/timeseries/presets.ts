import { FieldColorModeId, VisualizationPresetsSupplier, VisualizationSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  AxisPlacement,
  GraphDrawStyle,
  GraphFieldConfig,
  GraphGradientMode,
  LineInterpolation,
  VisibilityMode,
} from '@grafana/schema';
import { SUGGESTIONS_LEGEND_OPTIONS } from 'app/features/panel/suggestions/utils';

import { Options } from './panelcfg.gen';

const previewModifier = (s: VisualizationSuggestion<Options, GraphFieldConfig>) => {
  s.options!.disableKeyboardEvents = true;
  s.options!.legend = SUGGESTIONS_LEGEND_OPTIONS;
  if (s.fieldConfig?.defaults.custom?.drawStyle !== GraphDrawStyle.Bars) {
    s.fieldConfig!.defaults.custom!.lineWidth = Math.max(s.fieldConfig!.defaults.custom!.lineWidth ?? 1, 2);
  }
  s.fieldConfig!.defaults.custom!.axisPlacement = AxisPlacement.Hidden;
};

/**
 * @TODO: geometry support
 */

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
      color: {
        mode: FieldColorModeId.PaletteClassic,
      },
    },
    overrides: [],
  },
  cardOptions: { previewModifier },
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
      color: {
        mode: FieldColorModeId.PaletteClassic,
      },
    },
    overrides: [],
  },
  cardOptions: { previewModifier },
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
      color: {
        mode: FieldColorModeId.ContinuousPurples,
        seriesBy: 'max',
      },
    },
    overrides: [],
  },
  cardOptions: { previewModifier },
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
      color: {
        mode: FieldColorModeId.ContinuousMagma,
        seriesBy: 'max',
      },
    },
    overrides: [],
  },
  cardOptions: { previewModifier },
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
      color: {
        mode: FieldColorModeId.Fixed,
        fixedColor: '#d0d0d0',
        seriesBy: 'max',
      },
    },
    overrides: [],
  },
  cardOptions: { previewModifier },
});

export const timeseriesPresetsSupplier: VisualizationPresetsSupplier<Options, GraphFieldConfig> = (context) => {
  return [smoothPreset(), areaPreset(), stepPreset(), stepFilledPreset(), stepHuePreset()];
};
