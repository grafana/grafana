import {
  ArrayVector,
  DataFrame,
  DataFrameFieldIndex,
  Field,
  FieldLookup,
  FieldMap,
  FieldType,
  getDisplayProcessor,
  getFieldDisplayName,
  GrafanaTheme2,
  isBooleanUnit,
} from '@grafana/data';
import { GraphFieldConfig, LineInterpolation, StackingMode } from '@grafana/schema';

type PrepFieldLookup = (frames: DataFrame[]) => FieldLookup;

export const prepFieldLookup: PrepFieldLookup = (frames) => {
  const byIndex = new Map<number, DataFrameFieldIndex>();
  const byName = new Map<string, DataFrameFieldIndex>();

  let seriesIndex = 0;

  const fieldMaps = frames.map((frame, frameIndex) => {
    let fieldMap: FieldMap = {
      x: frame.fields.findIndex((field) => field.type === FieldType.time),
      y: frame.fields.reduce((indices, field, fieldIndex) => {
        // todo: use matchers?
        if (field.type === FieldType.number || field.type === FieldType.boolean) {
          const displayName = getFieldDisplayName(field, frame, frames);
          const fieldOrigin = { frameIndex, fieldIndex, seriesIndex, displayName };

          byIndex.set(seriesIndex, fieldOrigin);
          byName.set(displayName, fieldOrigin);

          indices.push(fieldIndex);
          seriesIndex++;
        }
        return indices;
      }, [] as number[]),
    };

    fieldMap.legend = fieldMap.y;
    fieldMap.tooltip = fieldMap.y;
    fieldMap.count = fieldMap.y.length;
  });

  return {
    fieldMaps,
    byIndex,
    byName,
    enumerate(frames) {
      byIndex.forEach(({ frameIndex, fieldIndex, seriesIndex }) => {
        let field = frames[frameIndex].fields[fieldIndex];
        let state = field.state ?? {};
        state.seriesIndex = seriesIndex;
        field.state = state;
      });
    },
  };
};

// This will return a set of frames with only graphable values included
export function prepareGraphableFields(
  series: DataFrame[] | undefined,
  theme: GrafanaTheme2,
  fieldLookup: FieldLookup
): { frames?: DataFrame[]; warn?: string } {
  if (!series?.length) {
    return { warn: 'No data in response' };
  }

  // sets field.state.seriesIndex for filtered/mapped dimensions
  fieldLookup.enumerate(series);

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
