import { ArrayVector, DataFrame, Field, FieldType } from '@grafana/data';
import { GraphFieldConfig, LineInterpolation } from '@grafana/ui';

// This will return a set of frames with only graphable values included
export function prepareGraphableFields(series?: DataFrame[]): { frames?: DataFrame[]; warn?: string } {
  if (!series?.length) {
    return { warn: 'No data in response' };
  }
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
          fields.push(field);
          break; // ok
        case FieldType.boolean:
          changed = true;
          const custom: GraphFieldConfig = field.config?.custom ?? {};
          const config = {
            ...field.config,
            unit: 'boolean', // TODO -- make the axis only show true/false
            max: 1,
            min: 0,
            custom,
          };
          // smooth and linear do not make sense
          if (custom.lineInterpolation !== LineInterpolation.StepBefore) {
            custom.lineInterpolation = LineInterpolation.StepAfter;
          }

          fields.push({
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
          });
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
