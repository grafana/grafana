import { type DataFrame, type FieldConfig, FieldType, LoadingState, ThresholdsMode } from '@grafana/data';
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
  /** whether the panel already received a response; refreshes keep the previous series while Loading */
  hasResponse: boolean;
  defaults: FieldConfig<GraphFieldConfig>;
}

export function getNoValuesShape({
  series,
  frames,
  warning,
  state,
  hasResponse,
  defaults,
}: NoValuesShapeOptions): NoValuesShape {
  if (state === LoadingState.Error || (state === LoadingState.Loading && !hasResponse) || warning) {
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
