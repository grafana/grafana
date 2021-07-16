import {
  DataFrame,
  Field,
  getFieldColorModeForField,
  getFieldDisplayName,
  getScaleCalculator,
  GrafanaTheme2,
} from '@grafana/data';
import { getMinMaxAndDelta } from '../../../../../../packages/grafana-data/src/field/scale';

export interface BaseDimensionConfig<T = any> {
  fixed: T;
  field?: string;
}

export interface ScaleDimensionOptions {
  min?: number;
  max?: number;
}

/** This will map the field value% to a scaled value within the range */
export interface ScaleDimensionConfig extends BaseDimensionConfig<number> {
  min: number;
  max: number;
}

export interface DimensionSupplier<T = any> {
  isAssumed?: boolean;
  field?: Field;
  fixed?: T;
  get: (index: number) => T;
}

/** Use the color value from field configs */
export interface ColorDimensionConfig extends BaseDimensionConfig<string> {}

function findField(frame: DataFrame, name?: string): Field | undefined {
  if (!name?.length) {
    return undefined;
  }

  for (const field of frame.fields) {
    if (name === field.name) {
      return field;
    }
    const disp = getFieldDisplayName(field, frame);
    if (name === disp) {
      return field;
    }
  }
  return undefined;
}

//---------------------------------------------------------
// Color dimension
//---------------------------------------------------------

export function getColorDimension(
  frame: DataFrame,
  config: ColorDimensionConfig,
  theme: GrafanaTheme2
): DimensionSupplier<string> {
  const field = findField(frame, config.field);
  if (!field) {
    const v = config.fixed ?? 'grey';
    return {
      isAssumed: Boolean(config.field?.length) || !config.fixed,
      fixed: v,
      get: (i) => v,
    };
  }
  const mode = getFieldColorModeForField(field);
  if (!mode.isByValue) {
    const fixed = mode.getCalculator(field, theme)(0, 0);
    return {
      fixed,
      get: (i) => fixed,
      field,
    };
  }
  const scale = getScaleCalculator(field, theme);
  return {
    get: (i) => {
      const val = field.values.get(i);
      return scale(val).color;
    },
    field,
  };
}

//---------------------------------------------------------
// Scale dimension
//---------------------------------------------------------

export function getScaledDimension(frame: DataFrame, config: ScaleDimensionConfig): DimensionSupplier<number> {
  const field = findField(frame, config.field);
  if (!field) {
    const v = config.fixed ?? 0;
    return {
      isAssumed: Boolean(config.field?.length) || !config.fixed,
      fixed: v,
      get: () => v,
    };
  }
  const info = getMinMaxAndDelta(field);
  const delta = config.max - config.min;
  const values = field.values;
  if (values.length < 1 || delta <= 0 || info.delta <= 0) {
    return {
      fixed: config.min,
      get: () => config.min,
    };
  }

  return {
    get: (i) => {
      const value = field.values.get(i);
      let percent = 0;
      if (value !== -Infinity) {
        percent = (value - info.min!) / info.delta;
      }
      return config.min + percent * delta;
    },
    field,
  };
}
