import {
  applyFieldOverrides,
  createDataFrame,
  type DataFrame,
  type FieldConfig,
  type FieldConfigSource,
  FieldType,
  type GrafanaTheme2,
  type InterpolateFunction,
  LoadingState,
  ThresholdsMode,
  type TimeRange,
} from '@grafana/data';
import { type GraphFieldConfig, GraphThresholdsStyleMode } from '@grafana/schema';

/**
 * How a response without values is drawn:
 * - `none`: render as today (data has values, or the panel must show an error/empty view)
 * - `no-frames`: nothing graphable came back, so thresholds need a placeholder field
 * - `no-values`: graphable frames exist but hold no values, so their own fields carry the thresholds
 */
export type NoValuesShape = 'none' | 'no-frames' | 'no-values';

interface NoValuesShapeOptions {
  /** raw response frames, before prepareGraphableFields */
  series: DataFrame[];
  /** output of prepareGraphableFields */
  frames: DataFrame[];
  /** a prepareGraphableFields warning, or a suggestion message */
  warning?: string;
  state: LoadingState;
  /** whether the last settled response was Done; refreshes keep the previous series while Loading */
  lastResponseSucceeded: boolean;
  defaults: FieldConfig<GraphFieldConfig>;
}

export function getNoValuesShape({
  series,
  frames,
  warning,
  state,
  lastResponseSucceeded,
  defaults,
}: NoValuesShapeOptions): NoValuesShape {
  if (state === LoadingState.Error || (state === LoadingState.Loading && !lastResponseSucceeded) || warning) {
    return 'none';
  }

  if (!frames.length) {
    // frames with rows that are not graphable (no time field, no number field) keep their error view
    if (series.some((frame) => frame.length > 0)) {
      return 'none';
    }
    return hasDrawableThresholds(defaults) ? 'no-frames' : 'none';
  }

  let hasThresholds = false;

  for (const frame of frames) {
    for (const field of frame.fields) {
      if (field.type === FieldType.time) {
        continue;
      }
      if (field.values.some((v) => v != null)) {
        return 'none';
      }
      hasThresholds ||= hasDrawableThresholds(field.config);
    }
  }

  return hasThresholds ? 'no-values' : 'none';
}

function hasDrawableThresholds(config: FieldConfig<GraphFieldConfig>): boolean {
  const { thresholds, custom } = config;
  const mode = custom?.thresholdsStyle?.mode ?? GraphThresholdsStyleMode.Off;

  if (mode === GraphThresholdsStyleMode.Off || !thresholds) {
    return false;
  }

  // percentage steps only resolve to values against an explicit min and max
  if (thresholds.mode === ThresholdsMode.Percentage && (config.min == null || config.max == null)) {
    return false;
  }

  // the first step is the -Infinity base and is never drawn
  return thresholds.steps.slice(1).some((step) => Number.isFinite(step.value));
}

/**
 * The value range of a field's thresholds, used as the y range of a scale with no values.
 * Percentage steps resolve against an explicit min and max; soft limits unfix that range, so it is not enough on its own.
 */
export function getThresholdsExtent(config: FieldConfig): [number, number] | undefined {
  const { thresholds, min, max } = config;
  if (!thresholds) {
    return undefined;
  }

  const isPercentage = thresholds.mode === ThresholdsMode.Percentage;
  if (isPercentage && (min == null || max == null)) {
    return undefined;
  }

  const values = thresholds.steps
    .slice(1)
    .map((step) => (isPercentage ? min! + ((max! - min!) * step.value) / 100 : step.value))
    .filter(Number.isFinite);

  return values.length ? [Math.min(...values), Math.max(...values)] : undefined;
}

const PLACEHOLDER_META_KEY = 'noValuesPlaceholder';

interface PlaceholderFrameOptions {
  timeRange: TimeRange;
  fieldConfig: FieldConfigSource<GraphFieldConfig>;
  theme: GrafanaTheme2;
  replaceVariables: InterpolateFunction;
  timeZone?: string;
}

/**
 * A frame with one null-valued number field across the time range, so that a response with no frames
 * still gets a plot to draw the panel's thresholds on.
 */
export function buildNoValuesPlaceholderFrame({
  timeRange,
  fieldConfig,
  theme,
  replaceVariables,
  timeZone,
}: PlaceholderFrameOptions): DataFrame {
  const frame = createDataFrame({
    meta: { custom: { [PLACEHOLDER_META_KEY]: true } },
    fields: [
      { name: 'time', type: FieldType.time, values: [timeRange.from.valueOf(), timeRange.to.valueOf()] },
      {
        name: 'noValuesPlaceholder',
        type: FieldType.number,
        values: [null, null],
        config: {
          // without the plugin's registry, applyFieldOverrides only fills standard options from defaults
          custom: { ...fieldConfig.defaults.custom, hideFrom: { legend: true, tooltip: true, viz: false } },
        },
      },
    ],
  });

  return applyFieldOverrides({ data: [frame], fieldConfig, theme, replaceVariables, timeZone })[0];
}

export function isNoValuesPlaceholderFrame(frame: DataFrame): boolean {
  return frame.meta?.custom?.[PLACEHOLDER_META_KEY] === true;
}
