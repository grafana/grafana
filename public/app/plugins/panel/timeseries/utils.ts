import {
  ArrayVector,
  DataFrame,
  Field,
  FieldType,
  getDisplayProcessor,
  GrafanaTheme2,
  isBooleanUnit,
} from '@grafana/data';
import { GraphFieldConfig, LineInterpolation, StackingMode } from '@grafana/ui';

// This will return a set of frames with only graphable values included
export function prepareGraphableFields(
  series: DataFrame[] | undefined,
  theme: GrafanaTheme2
): { frames?: DataFrame[]; warn?: string } {
  if (!series?.length) {
    return { warn: 'No data in response' };
  }
  let copy: Field;
  let hasTimeseries = false;
  const frames: DataFrame[] = [];

  for (let frame of series) {
    let isTimeseries = false;
    let changed = false;
    const fields: Field[] = [];

    for (const field of frame.fields) {
      switch (field.type) {
        case FieldType.time:
          isTimeseries = true;
          hasTimeseries = true;
          fields.push(field);
          break;
        case FieldType.number:
          changed = true;
          copy = {
            ...field,
            values: new ArrayVector(
              field.values.toArray().map((v) => {
                if (!(Number.isFinite(v) || v == null)) {
                  return null;
                }
                return v;
              })
            ),
          };

          if (copy.config.custom?.stacking?.mode === StackingMode.Percent) {
            copy.config.unit = 'percentunit';
            copy.display = getDisplayProcessor({ field: copy, theme });
          }

          fields.push(copy);
          break; // ok
        case FieldType.boolean:
          changed = true;
          const custom: GraphFieldConfig = field.config?.custom ?? {};
          const config = {
            ...field.config,
            max: 1,
            min: 0,
            custom,
          };
          // smooth and linear do not make sense
          if (custom.lineInterpolation !== LineInterpolation.StepBefore) {
            custom.lineInterpolation = LineInterpolation.StepAfter;
          }
          copy = {
            ...field,
            config,
            type: FieldType.number,
            values: new ArrayVector(
              field.values.toArray().map((v) => {
                if (v == null) {
                  return v;
                }
                return Boolean(v) ? 1 : 0;
              })
            ),
          };
          if (!isBooleanUnit(config.unit)) {
            config.unit = 'bool';
            copy.display = getDisplayProcessor({ field: copy, theme });
          }
          fields.push(copy);
          break;
        default:
          changed = true;
      }
    }

    if (isTimeseries && fields.length > 1) {
      hasTimeseries = true;
      if (changed) {
        frames.push({
          ...frame,
          fields,
        });
      } else {
        frames.push(frame);
      }
    }
  }

  if (!hasTimeseries) {
    return { warn: 'Data does not have a time field' };
  }
  if (!frames.length) {
    return { warn: 'No graphable fields' };
  }
  return { frames };
}
