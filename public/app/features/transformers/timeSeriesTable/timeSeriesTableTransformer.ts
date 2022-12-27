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
  const table = new MutableDataFrame();
  const labelFields = getLabelFields(data);
  const frameField: Field<DataFrame, ArrayVector> = {
    name: 'Trend',
    type: FieldType.frame,
    config: {},
    values: new ArrayVector(),
  };

  for (const label of Object.values(labelFields)) {
    table.addField(label);
  }

  table.addField(frameField);

  for (const frame of data) {
    if (!isTimeSeries(frame)) {
      continue;
    }

    const labels = frame.fields[1].labels;

    for (const labelKey of Object.keys(labelFields)) {
      const labelValue = getLabelValue(labelKey, labels);
      labelFields[labelKey].values.add(labelValue);
    }

    frameField.values.add(frame);
  }

  return [table];
}

function getLabelFields(frames: DataFrame[]): Record<string, Field<string, ArrayVector>> {
  const labelFields: Record<string, Field<string, ArrayVector>> = {};

  for (const frame of frames) {
    if (!isTimeSeries(frame)) {
      continue;
    }

    for (const field of frame.fields) {
      if (!field.labels) {
        continue;
      }

      for (const labelName of Object.keys(field.labels)) {
        if (!labelFields[labelName]) {
          labelFields[labelName] = {
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
