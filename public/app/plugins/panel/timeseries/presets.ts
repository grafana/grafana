import {
  FieldColorModeId,
  type FieldConfigSource,
  FieldType,
  ThresholdsMode,
  type VisualizationPresetsSupplier,
  type VisualizationSuggestion,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  AxisPlacement,
  GraphDrawStyle,
  type GraphFieldConfig,
  GraphGradientMode,
  LineInterpolation,
  StackingMode,
  VisibilityMode,
} from '@grafana/schema';
import { SUGGESTIONS_LEGEND_OPTIONS } from 'app/features/panel/suggestions/utils';

import { defaultGraphConfig } from './config';
import { type Options } from './panelcfg.gen';

/**
 * Default values
 */
const PRESET_STYLE_DEFAULTS: Partial<GraphFieldConfig> = {
  drawStyle: defaultGraphConfig.drawStyle,
  lineInterpolation: defaultGraphConfig.lineInterpolation,
  lineWidth: defaultGraphConfig.lineWidth,
  fillOpacity: defaultGraphConfig.fillOpacity,
  gradientMode: defaultGraphConfig.gradientMode,
  stacking: defaultGraphConfig.stacking,
  barWidthFactor: defaultGraphConfig.barWidthFactor,
  lineStyle: { fill: 'solid' },
};

const previewModifier = (s: VisualizationSuggestion<Options, GraphFieldConfig>) => {
  s.options!.disableKeyboardEvents = true;
  s.options!.legend = SUGGESTIONS_LEGEND_OPTIONS;
  if (s.fieldConfig?.defaults.custom?.drawStyle !== GraphDrawStyle.Bars) {
    s.fieldConfig!.defaults.custom!.lineWidth = Math.max(s.fieldConfig!.defaults.custom!.lineWidth ?? 1, 2);
  }
  s.fieldConfig!.defaults.custom!.axisPlacement = AxisPlacement.Hidden;
};

function makePreset(
  name: string,
  fieldConfig: FieldConfigSource<Partial<GraphFieldConfig>>,
  maxRows?: number
): VisualizationSuggestion<Options, GraphFieldConfig> {
  return {
    name,
    fieldConfig: {
      defaults: {
        ...fieldConfig.defaults,
        custom: { ...PRESET_STYLE_DEFAULTS, ...fieldConfig.defaults.custom },
      },
      overrides: fieldConfig.overrides,
    },
    cardOptions: { previewModifier, maxRows, maxSeries: MAX_PREVIEW_SERIES },
  };
}

// --- Single series ---

/** Line with opacity fill */
const makeSingleLineFillConfig = (pointSize: number): FieldConfigSource<Partial<GraphFieldConfig>> => ({
  defaults: {
    custom: {
      fillOpacity: 27,
      gradientMode: GraphGradientMode.Opacity,
      showPoints: VisibilityMode.Auto,
      pointSize,
    },
    color: { mode: FieldColorModeId.PaletteClassic, seriesBy: 'last' },
  },
  overrides: [],
});

const FC_SINGLE_SMOOTH_SCHEME: FieldConfigSource<Partial<GraphFieldConfig>> = {
  defaults: {
    custom: {
      lineInterpolation: LineInterpolation.Smooth,
      lineWidth: 2,
      fillOpacity: 19,
      gradientMode: GraphGradientMode.Scheme,
      showPoints: VisibilityMode.Never,
      pointSize: 5,
    },
    color: { mode: FieldColorModeId.ContinuousBlYlRd, seriesBy: 'last' },
  },
  overrides: [],
};

const FC_SINGLE_DASHED_THRESHOLD: FieldConfigSource<Partial<GraphFieldConfig>> = {
  defaults: {
    custom: {
      fillOpacity: 39,
      gradientMode: GraphGradientMode.Scheme,
      showPoints: VisibilityMode.Never,
      pointSize: 5,
      lineStyle: { fill: 'dash', dash: [10, 10] },
    },
    color: { mode: FieldColorModeId.Thresholds, seriesBy: 'last' },
  },
  overrides: [],
};

const FC_SINGLE_STEP_FILL: FieldConfigSource<Partial<GraphFieldConfig>> = {
  defaults: {
    custom: {
      lineInterpolation: LineInterpolation.StepBefore,
      lineWidth: 2,
      fillOpacity: 25,
      gradientMode: GraphGradientMode.Opacity,
      showPoints: VisibilityMode.Never,
      pointSize: 5,
    },
    color: { mode: FieldColorModeId.PaletteClassic, seriesBy: 'last' },
  },
  overrides: [],
};

const FC_SINGLE_BARS_HUE: FieldConfigSource<Partial<GraphFieldConfig>> = {
  defaults: {
    custom: {
      drawStyle: GraphDrawStyle.Bars,
      fillOpacity: 70,
      gradientMode: GraphGradientMode.Hue,
      showPoints: VisibilityMode.Auto,
      pointSize: 5,
    },
    color: { mode: FieldColorModeId.PaletteClassic, seriesBy: 'last' },
  },
  overrides: [],
};

const FC_SINGLE_BARS_SCHEME: FieldConfigSource<Partial<GraphFieldConfig>> = {
  defaults: {
    custom: {
      drawStyle: GraphDrawStyle.Bars,
      fillOpacity: 70,
      gradientMode: GraphGradientMode.Scheme,
      showPoints: VisibilityMode.Auto,
      pointSize: 5,
    },
    color: { mode: FieldColorModeId.ContinuousGrYlRd, seriesBy: 'last' },
  },
  overrides: [],
};

const FC_SINGLE_LINE_HUE: FieldConfigSource<Partial<GraphFieldConfig>> = {
  defaults: {
    custom: {
      fillOpacity: 57,
      gradientMode: GraphGradientMode.Hue,
      showPoints: VisibilityMode.Auto,
      pointSize: 5,
    },
    color: { mode: FieldColorModeId.PaletteClassic, seriesBy: 'last' },
  },
  overrides: [],
};

const FC_SINGLE_LINE_SCHEME: FieldConfigSource<Partial<GraphFieldConfig>> = {
  defaults: {
    custom: {
      lineWidth: 2,
      fillOpacity: 17,
      gradientMode: GraphGradientMode.Scheme,
      showPoints: VisibilityMode.Auto,
      pointSize: 3,
    },
    color: { mode: FieldColorModeId.ContinuousGrYlRd, seriesBy: 'last' },
  },
  overrides: [],
};

const FC_SINGLE_THRESHOLD_SCHEME: FieldConfigSource<Partial<GraphFieldConfig>> = {
  defaults: {
    custom: {
      fillOpacity: 27,
      gradientMode: GraphGradientMode.Scheme,
      showPoints: VisibilityMode.Auto,
      pointSize: 3,
    },
    color: { mode: 'thresholds', seriesBy: 'last' },
    thresholds: {
      mode: ThresholdsMode.Percentage,
      steps: [
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        { value: null as unknown as number, color: 'green' },
        { value: 40, color: '#EAB839' },
        { value: 60, color: 'red' },
      ],
    },
  },
  overrides: [],
};

// --- Multi series ---

/** Lines with small always-visible points; shared between few-points and many-points */
const FC_MULTI_POINTS: FieldConfigSource<Partial<GraphFieldConfig>> = {
  defaults: {
    custom: {
      showPoints: VisibilityMode.Always,
      pointSize: 1,
      barWidthFactor: 0.9,
    },
    color: { mode: FieldColorModeId.PaletteClassic, seriesBy: 'max' },
  },
  overrides: [],
};

/** Stacked lines with fill; stackingMode is the only difference between Normal and Percent variants */
const makeMultiStackedConfig = (stackingMode: StackingMode): FieldConfigSource<Partial<GraphFieldConfig>> => ({
  defaults: {
    custom: {
      stacking: { mode: stackingMode, group: 'A' },
      lineWidth: 2,
      fillOpacity: 50,
      showPoints: VisibilityMode.Always,
      pointSize: 1,
      barWidthFactor: 0.9,
    },
    color: { mode: FieldColorModeId.PaletteClassic, seriesBy: 'max' },
  },
  overrides: [],
});

const FC_MULTI_STACKED_BARS: FieldConfigSource<Partial<GraphFieldConfig>> = {
  defaults: {
    custom: {
      stacking: { mode: StackingMode.Normal, group: 'A' },
      drawStyle: GraphDrawStyle.Bars,
      fillOpacity: 68,
      showPoints: VisibilityMode.Always,
      pointSize: 1,
      barWidthFactor: 0.9,
    },
    color: { mode: FieldColorModeId.PaletteClassic, seriesBy: 'max' },
  },
  overrides: [],
};

const FEW_POINTS_THRESHOLD = 80;
const MAX_PREVIEW_BAR_ROWS = 30;
const MAX_PREVIEW_SERIES = 8;

export const timeseriesPresetsSupplier: VisualizationPresetsSupplier<Options, GraphFieldConfig> = ({ dataSummary }) => {
  if (
    !dataSummary?.hasData ||
    !dataSummary.hasFieldType(FieldType.time) ||
    !dataSummary.hasFieldType(FieldType.number)
  ) {
    return [];
  }

  const isSingleSeries = (dataSummary?.frameCount ?? 0) === 1;
  const isMultiSeries = (dataSummary?.frameCount ?? 0) > 1;
  const hasFewPoints = (dataSummary?.rowCountMax ?? 0) < FEW_POINTS_THRESHOLD;

  if (isSingleSeries) {
    if (hasFewPoints) {
      return [
        makePreset(t('timeseries.presets.single-few-points', 'Single fill'), makeSingleLineFillConfig(4)),
        makePreset(t('timeseries.presets.single-smooth-scheme', 'Smooth scheme'), FC_SINGLE_SMOOTH_SCHEME),
        makePreset(t('timeseries.presets.single-dashed-threshold', 'Dashed threshold'), FC_SINGLE_DASHED_THRESHOLD),
        makePreset(t('timeseries.presets.single-step-fill', 'Step fill'), FC_SINGLE_STEP_FILL),
        makePreset(t('timeseries.presets.single-bars', 'Bars'), FC_SINGLE_BARS_HUE, MAX_PREVIEW_BAR_ROWS),
        makePreset(
          t('timeseries.presets.single-bars-scheme', 'Bars scheme'),
          FC_SINGLE_BARS_SCHEME,
          MAX_PREVIEW_BAR_ROWS
        ),
      ];
    } else {
      return [
        makePreset(t('timeseries.presets.single-many-points-fill', 'Line fill'), makeSingleLineFillConfig(5)),
        makePreset(t('timeseries.presets.single-many-points-hue', 'Line hue'), FC_SINGLE_LINE_HUE),
        makePreset(t('timeseries.presets.single-many-points-scheme', 'Line scheme'), FC_SINGLE_LINE_SCHEME),
        makePreset(
          t('timeseries.presets.single-many-points-threshold-scheme', 'Threshold scheme'),
          FC_SINGLE_THRESHOLD_SCHEME
        ),
      ];
    }
  } else if (isMultiSeries) {
    if (hasFewPoints) {
      return [
        makePreset(t('timeseries.presets.multi-points', 'Lines with points'), FC_MULTI_POINTS),
        makePreset(
          t('timeseries.presets.multi-stacked-points', 'Stacked lines'),
          makeMultiStackedConfig(StackingMode.Normal)
        ),
        makePreset(
          t('timeseries.presets.multi-stacked-bars', 'Stacked bars'),
          FC_MULTI_STACKED_BARS,
          MAX_PREVIEW_BAR_ROWS
        ),
      ];
    } else {
      return [
        makePreset(t('timeseries.presets.multi-many-points', 'Lines with points'), FC_MULTI_POINTS),
        makePreset(
          t('timeseries.presets.multi-many-points-stacked', 'Stacked lines'),
          makeMultiStackedConfig(StackingMode.Normal)
        ),
        makePreset(
          t('timeseries.presets.multi-many-points-stacked-pct', 'Stacked 100%'),
          makeMultiStackedConfig(StackingMode.Percent)
        ),
      ];
    }
  }

  return [];
};
