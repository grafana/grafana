import {
  FieldColorModeId,
  FieldConfigSource,
  ThresholdsMode,
  VisualizationPresetsSupplier,
  VisualizationSuggestion,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  AxisPlacement,
  GraphDrawStyle,
  GraphFieldConfig,
  GraphGradientMode,
  LineInterpolation,
  StackingMode,
  VisibilityMode,
} from '@grafana/schema';
import { SUGGESTIONS_LEGEND_OPTIONS } from 'app/features/panel/suggestions/utils';

import { defaultGraphConfig } from './config';
import { Options } from './panelcfg.gen';

const previewModifier = (s: VisualizationSuggestion<Options, GraphFieldConfig>) => {
  s.options!.disableKeyboardEvents = true;
  s.options!.legend = SUGGESTIONS_LEGEND_OPTIONS;
  if (s.fieldConfig?.defaults.custom?.drawStyle !== GraphDrawStyle.Bars) {
    s.fieldConfig!.defaults.custom!.lineWidth = Math.max(s.fieldConfig!.defaults.custom!.lineWidth ?? 1, 2);
  }
  s.fieldConfig!.defaults.custom!.axisPlacement = AxisPlacement.Hidden;
};

const STACKING_OFF: GraphFieldConfig = {
  stacking: { mode: StackingMode.None, group: 'A' },
};

function makePreset(
  name: string,
  fieldConfig: FieldConfigSource<Partial<GraphFieldConfig>>
): VisualizationSuggestion<Options, GraphFieldConfig> {
  return { name, fieldConfig, cardOptions: { previewModifier } };
}

// --- Single series ---

/** Line with opacity fill */
const makeSingleLineFillConfig = (pointSize: number): FieldConfigSource<Partial<GraphFieldConfig>> => ({
  defaults: {
    custom: {
      ...STACKING_OFF,
      drawStyle: GraphDrawStyle.Line,
      lineInterpolation: LineInterpolation.Linear,
      lineWidth: 1,
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
      ...STACKING_OFF,
      drawStyle: GraphDrawStyle.Line,
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
      ...STACKING_OFF,
      drawStyle: GraphDrawStyle.Line,
      lineInterpolation: LineInterpolation.Linear,
      lineWidth: 1,
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
      ...STACKING_OFF,
      drawStyle: GraphDrawStyle.Line,
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
      ...STACKING_OFF,
      drawStyle: GraphDrawStyle.Bars,
      lineWidth: 1,
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
      ...STACKING_OFF,
      drawStyle: GraphDrawStyle.Bars,
      lineWidth: 1,
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
      ...STACKING_OFF,
      drawStyle: GraphDrawStyle.Line,
      lineInterpolation: LineInterpolation.Linear,
      lineWidth: 1,
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
      ...STACKING_OFF,
      drawStyle: GraphDrawStyle.Line,
      lineInterpolation: LineInterpolation.Linear,
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
      ...STACKING_OFF,
      drawStyle: GraphDrawStyle.Line,
      lineInterpolation: LineInterpolation.Linear,
      lineWidth: 1,
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
      ...STACKING_OFF,
      drawStyle: GraphDrawStyle.Line,
      lineInterpolation: LineInterpolation.Linear,
      lineWidth: 1,
      fillOpacity: 0,
      gradientMode: GraphGradientMode.None,
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
      drawStyle: GraphDrawStyle.Line,
      lineInterpolation: LineInterpolation.Linear,
      lineWidth: 2,
      fillOpacity: 50,
      gradientMode: GraphGradientMode.None,
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
      lineWidth: 1,
      fillOpacity: 68,
      gradientMode: GraphGradientMode.None,
      showPoints: VisibilityMode.Always,
      pointSize: 1,
      barWidthFactor: 0.9,
    },
    color: { mode: FieldColorModeId.PaletteClassic, seriesBy: 'max' },
  },
  overrides: [],
};

const defaultPreset = (): VisualizationSuggestion<Options, GraphFieldConfig> => ({
  name: t('timeseries.presets.default', 'Default'),
  fieldConfig: {
    defaults: {
      custom: { ...defaultGraphConfig },
      color: { mode: FieldColorModeId.PaletteClassic },
    },
    overrides: [],
  },
  cardOptions: { previewModifier },
});

const FEW_POINTS_THRESHOLD = 80;

export const timeseriesPresetsSupplier: VisualizationPresetsSupplier<Options, GraphFieldConfig> = ({ dataSummary }) => {
  const isSingleSeries = (dataSummary?.frameCount ?? 0) === 1;
  const isMultiSeries = (dataSummary?.frameCount ?? 0) > 1;
  const hasFewPoints = (dataSummary?.rowCountMax ?? 0) < FEW_POINTS_THRESHOLD;
  const hasManyPoints = (dataSummary?.rowCountMax ?? 0) >= FEW_POINTS_THRESHOLD;

  if (isSingleSeries && hasFewPoints) {
    return [
      makePreset(t('timeseries.presets.single-few-points', 'Single fill'), makeSingleLineFillConfig(4)),
      makePreset(t('timeseries.presets.single-smooth-scheme', 'Smooth scheme'), FC_SINGLE_SMOOTH_SCHEME),
      makePreset(t('timeseries.presets.single-dashed-threshold', 'Dashed threshold'), FC_SINGLE_DASHED_THRESHOLD),
      makePreset(t('timeseries.presets.single-step-fill', 'Step fill'), FC_SINGLE_STEP_FILL),
      makePreset(t('timeseries.presets.single-bars', 'Bars'), FC_SINGLE_BARS_HUE),
      makePreset(t('timeseries.presets.single-bars-scheme', 'Bars scheme'), FC_SINGLE_BARS_SCHEME),
    ];
  }

  if (isSingleSeries && hasManyPoints) {
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

  if (isMultiSeries && hasFewPoints) {
    return [
      makePreset(t('timeseries.presets.multi-points', 'Points'), FC_MULTI_POINTS),
      makePreset(
        t('timeseries.presets.multi-stacked-points', 'Stacked points'),
        makeMultiStackedConfig(StackingMode.Normal)
      ),
      makePreset(t('timeseries.presets.multi-stacked-bars', 'Stacked bars'), FC_MULTI_STACKED_BARS),
    ];
  }

  if (isMultiSeries && hasManyPoints) {
    return [
      makePreset(t('timeseries.presets.multi-many-points', 'Points'), FC_MULTI_POINTS),
      makePreset(
        t('timeseries.presets.multi-many-points-stacked', 'Stacked points'),
        makeMultiStackedConfig(StackingMode.Normal)
      ),
      makePreset(
        t('timeseries.presets.multi-many-points-stacked-pct', 'Stacked 100%'),
        makeMultiStackedConfig(StackingMode.Percent)
      ),
    ];
  }

  // @TODO
  return [defaultPreset()];
};
