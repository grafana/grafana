import { map } from 'rxjs/operators';

import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  DataTransformerInfo,
  Field,
  FieldType,
  Labels,
  MutableDataFrame,
} from '@grafana/data';

export interface TimeSeriesTableTransformerOptions {}

export const timeSeriesTableTransformer: DataTransformerInfo<TimeSeriesTableTransformerOptions> = {
  id: DataTransformerID.timeSeriesTable,
  name: 'Time series to table transform',
  description: 'Time series to table rows',
  defaultOptions: {},

  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        return timeSeriesToTableTransform(options, data);
      })
    ),
};

export function timeSeriesToTableTransform(options: TimeSeriesTableTransformerOptions, data: DataFrame[]): DataFrame[] {
  const refId2LabelFields = getLabelFields(data);

  const refId2frameField: Record<string, Field<DataFrame, ArrayVector>> = {};

  const result: DataFrame[] = [];

  for (const frame of data) {
    if (!isTimeSeries(frame)) {
      result.push(frame);
    }

    const refId = frame.refId ?? '';

    const labelFields = refId2LabelFields[refId] ?? {};
    let frameField = refId2frameField[refId];
    if (!frameField) {
      frameField = {
        name: 'Trend' + (refId && Object.keys(refId2LabelFields).length > 1 ? ` #${refId}` : ''),
        type: FieldType.frame,
        config: {},
        values: new ArrayVector(),
      };
      refId2frameField[refId] = frameField;
      const table = new MutableDataFrame();
      for (const label of Object.values(labelFields)) {
        table.addField(label);
      }
      table.addField(frameField);
      table.refId = refId;
      result.push(table);
    }

    const labels = frame.fields[1].labels;

    for (const labelKey of Object.keys(labelFields)) {
      const labelValue = getLabelValue(labelKey, labels);
      labelFields[labelKey].values.add(labelValue);
    }

    frameField.values.add(frame);
  }
  return result;
}

function getLabelFields(frames: DataFrame[]): Record<string, Record<string, Field<string, ArrayVector>>> {
  // refId -> label name -> label value -> values
  const labelFields: Record<string, Record<string, Field<string, ArrayVector>>> = {};

  for (const frame of frames) {
    if (!isTimeSeries(frame)) {
      continue;
    }

    const refId = frame.refId ?? '';

    if (!labelFields[refId]) {
      labelFields[refId] = {};
    }

    for (const field of frame.fields) {
      if (!field.labels) {
        continue;
      }

      for (const labelName of Object.keys(field.labels)) {
        if (!labelFields[refId][labelName]) {
          labelFields[refId][labelName] = {
            name: labelName,
            type: FieldType.string,
            config: {},
            values: new ArrayVector(),
          };
        }
      }
    }
  }

  return labelFields;
}

function getLabelValue(key: string, labels: Labels | undefined) {
  if (!labels) {
    return null;
  }

  return labels[key] ?? null;
}

export function isTimeSeries(frame: DataFrame) {
  if (frame.fields.length > 2) {
    return false;
  }

  return Boolean(frame.fields.find((field) => field.type === FieldType.time));
}
