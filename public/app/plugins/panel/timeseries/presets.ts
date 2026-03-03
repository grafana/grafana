import { FieldColorModeId, VisualizationPresetsSupplier, VisualizationSuggestion } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  AxisColorMode,
  AxisPlacement,
  GraphDrawStyle,
  GraphFieldConfig,
  GraphGradientMode,
  LineInterpolation,
  ScaleDistribution,
  StackingMode,
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

const isStacked = (context: Parameters<VisualizationPresetsSupplier<Options, GraphFieldConfig>>[0]): boolean => {
  const mode = context.fieldConfig?.defaults?.custom?.stacking?.mode;
  return mode === StackingMode.Normal || mode === StackingMode.Percent;
};

// Shared options for (3) step presets
const STEP_BASE_CUSTOM: GraphFieldConfig = {
  lineWidth: 1,
  lineInterpolation: LineInterpolation.StepBefore,
  showPoints: VisibilityMode.Auto,
  pointSize: 1,
};

// Shared options for stacked presets
const STACKED_BASE_CUSTOM: GraphFieldConfig = {
  drawStyle: GraphDrawStyle.Line,
  barAlignment: 0,
  spanNulls: false,
  insertNulls: false,
  lineStyle: { fill: 'solid' },
};

// Shared options for the (2) stacked area presets
const STACKED_AREA_BASE_CUSTOM: GraphFieldConfig = {
  ...STACKED_BASE_CUSTOM,
  barWidthFactor: 0.6,
  lineInterpolation: LineInterpolation.Linear,
  gradientMode: GraphGradientMode.Opacity,
  lineWidth: 1,
  showValues: false,
};

/**
 * @TODO: geometry support
 */

/**
 * Default preset
 */
const defaultPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('timeseries.presets.default', 'Default'),
  fieldConfig: {
    defaults: {
      custom: {},
    },
    overrides: [],
  },
  cardOptions: { previewModifier },
});

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
        ...STEP_BASE_CUSTOM,
        fillOpacity: 0,
        gradientMode: GraphGradientMode.Opacity,
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
        ...STEP_BASE_CUSTOM,
        fillOpacity: 45,
        gradientMode: GraphGradientMode.Opacity,
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
        ...STEP_BASE_CUSTOM,
        fillOpacity: 45,
        gradientMode: GraphGradientMode.Hue,
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

/**
 * STACKED
 */

const stackedStepPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('timeseries.presets.stacked-step', 'Stacked step'),
  fieldConfig: {
    defaults: {
      custom: {
        ...STACKED_BASE_CUSTOM,
        barWidthFactor: 0.3,
        lineInterpolation: LineInterpolation.StepBefore,
        gradientMode: GraphGradientMode.Hue,
        lineWidth: 1,
        fillOpacity: 40,
        showPoints: VisibilityMode.Auto,
        pointSize: 1,
        scaleDistribution: { type: ScaleDistribution.Linear },
        stacking: { mode: StackingMode.Normal, group: 'A' },
      },
      color: {
        mode: FieldColorModeId.Fixed,
        fixedColor: '#90a1b9',
        seriesBy: 'max',
      },
    },
    overrides: [],
  },
  cardOptions: { previewModifier },
});

const smoothStackedPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('timeseries.presets.stacked-smooth', 'Stacked smooth'),
  fieldConfig: {
    defaults: {
      custom: {
        ...STACKED_BASE_CUSTOM,
        barWidthFactor: 0.3,
        lineInterpolation: LineInterpolation.Smooth,
        gradientMode: GraphGradientMode.Hue,
        lineWidth: 0,
        fillOpacity: 100,
        showPoints: VisibilityMode.Auto,
        pointSize: 4,
        scaleDistribution: { type: ScaleDistribution.Linear },
        stacking: { mode: StackingMode.Normal, group: 'A' },
        axisColorMode: AxisColorMode.Text,
      },
      color: {
        mode: 'palette-classic',
        seriesBy: 'max',
      },
    },
    overrides: [],
  },
  cardOptions: { previewModifier },
});

const stackedAreaPercentPointsPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('timeseries.presets.stacked-area', 'Stacked area'),
  fieldConfig: {
    defaults: {
      custom: {
        ...STACKED_AREA_BASE_CUSTOM,
        fillOpacity: 40,
        showPoints: VisibilityMode.Always,
        pointSize: 4,
        scaleDistribution: { type: ScaleDistribution.Linear },
        stacking: { mode: StackingMode.Percent, group: 'A' },
      },
      color: {
        mode: 'palette-classic-by-name',
      },
    },
    overrides: [],
  },
  cardOptions: { previewModifier },
});

const stackedAreaGradientPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('timeseries.presets.stacked-area-gradient', 'Stacked area gradient'),
  fieldConfig: {
    defaults: {
      custom: {
        ...STACKED_AREA_BASE_CUSTOM,
        fillOpacity: 100,
        showPoints: VisibilityMode.Auto,
        pointSize: 5,
        stacking: { mode: StackingMode.Normal, group: 'A' },
      },
      color: {
        mode: 'continuous-viridis',
        seriesBy: 'last',
      },
    },
    overrides: [],
  },
  cardOptions: { previewModifier },
});

export const timeseriesPresetsSupplier: VisualizationPresetsSupplier<Options, GraphFieldConfig> = (context) => {
  if (isStacked(context)) {
    return [stackedStepPreset(), smoothStackedPreset(), stackedAreaPercentPointsPreset(), stackedAreaGradientPreset()];
  }

  return [defaultPreset(), smoothPreset(), areaPreset(), stepPreset(), stepFilledPreset(), stepHuePreset()];
};
