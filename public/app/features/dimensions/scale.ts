import { DataFrame, Field } from '@grafana/data';
import { getMinMaxAndDelta } from '@grafana/data/src/field/scale';

import { ScaleDimensionConfig, DimensionSupplier, ScaleDimensionOptions } from './types';
import { findField, getLastNotNullFieldValue } from './utils';

import { ScaleDimensionMode } from '.';

//---------------------------------------------------------
// Scale dimension
//---------------------------------------------------------

export function getScaledDimension(
  frame: DataFrame | undefined,
  config: ScaleDimensionConfig
): DimensionSupplier<number> {
  return getScaledDimensionForField(findField(frame, config?.field), config);
}

export function getScaledDimensionForField(
  field: Field | undefined,
  config: ScaleDimensionConfig,
  mode?: ScaleDimensionMode
): DimensionSupplier<number> {
  if (!field) {
    const v = config.fixed ?? 0;
    return {
      isAssumed: Boolean(config.field?.length) || !config.fixed,
      fixed: v,
      value: () => v,
      get: () => v,
    };
  }
  const info = getMinMaxAndDelta(field);
  const delta = config.max - config.min;
  const values = field.values;
  if (values.length < 1 || delta <= 0 || info.delta <= 0) {
    return {
      fixed: config.min,
      value: () => config.min,
      get: () => config.min,
    };
  }

  let scaled = (percent: number) => config.min + percent * delta;
  if (mode === ScaleDimensionMode.Quadratic) {
    const maxArea = Math.PI * (config.max / 2) ** 2;
    const minArea = Math.PI * (config.min / 2) ** 2;
    const deltaArea = maxArea - minArea;

    // quadratic scaling (px area)
    scaled = (percent: number) => {
      let area = minArea + deltaArea * percent;
      return Math.sqrt(area / Math.PI) * 2;
    };
  }

  const get = (i: number) => {
    const value = field.values.get(i);
    let percent = 0;
    if (value !== -Infinity) {
      percent = (value - info.min!) / info.delta;
    }
    if (percent > 1) {
      percent = 1;
    } else if (percent < 0) {
      percent = 0;
    }
    return scaled(percent);
  };

  return {
    get,
    value: () => get(getLastNotNullFieldValue(field)),
    field,
  };
}

// This will mutate options
export function validateScaleOptions(options?: ScaleDimensionOptions): ScaleDimensionOptions {
  if (!options) {
    options = { min: 0, max: 1 };
  }
  if (options.min == null) {
    options.min = 0;
  }
  if (options.max == null) {
    options.max = 1;
  }

  return options;
}

/** Mutates and will return a valid version */
export function validateScaleConfig(copy: ScaleDimensionConfig, options: ScaleDimensionOptions): ScaleDimensionConfig {
  let { min, max } = validateScaleOptions(options);
  if (!copy) {
    copy = {} as any;
  }

  if (copy.max == null) {
    copy.max = max;
  }
  if (copy.min == null) {
    copy.min = min;
  }
  // Make sure the order is right
  if (copy.min > copy.max) {
    const tmp = copy.max;
    copy.max = copy.min;
    copy.min = tmp;
  }
  // Validate range
  if (copy.min < min) {
    copy.min = min;
  }
  if (copy.max > max) {
    copy.max = max;
  }

  if (copy.fixed == null) {
    copy.fixed = copy.min + (copy.max - copy.min) / 2.0;
  }

  // Make sure the field value is within the absolute range
  if (!copy.field) {
    if (copy.fixed > max) {
      copy.fixed = max;
    } else if (copy.fixed < min) {
      copy.fixed = min;
    }
  }
  return copy;
}
