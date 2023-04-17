import { map } from 'rxjs/operators';

import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  DataTransformerInfo,
  Field,
  FieldType,
  MutableDataFrame,
  isTimeSeriesFrame,
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

/**
 * Converts time series frames to table frames for use with sparkline chart type.
 *
 * @remarks
 * For each refId (queryName) convert all time series frames into a single table frame, adding each series
 * as values of a "Trend" frame field. This allows "Trend" to be rendered as area chart type.
 * Any non time series frames are returned as is.
 *
 * @param options - Transform options, currently not used
 * @param data - Array of data frames to transform
 * @returns Array of transformed data frames
 *
 * @alpha
 */
export function timeSeriesToTableTransform(options: TimeSeriesTableTransformerOptions, data: DataFrame[]): DataFrame[] {
  // initialize fields from labels for each refId
  const refId2LabelFields = getLabelFields(data);

  const refId2frameField: Record<string, Field<DataFrame, ArrayVector>> = {};

  const result: DataFrame[] = [];

  for (const frame of data) {
    if (!isTimeSeriesFrame(frame)) {
      result.push(frame);
      continue;
    }

    const refId = frame.refId ?? '';

    const labelFields = refId2LabelFields[refId] ?? {};
    // initialize a new frame for this refId with fields per label and a Trend frame field, if it doesn't exist yet
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

    // add values to each label based field of this frame
    const labels = frame.fields[1].labels;
    for (const labelKey of Object.keys(labelFields)) {
      const labelValue = labels?.[labelKey] ?? null;
      labelFields[labelKey].values.add(labelValue!);
    }

    frameField.values.add(frame);
  }
  return result;
}

// For each refId, initialize a field for each label name
function getLabelFields(frames: DataFrame[]): Record<string, Record<string, Field<string, ArrayVector>>> {
  // refId -> label name -> field
  const labelFields: Record<string, Record<string, Field<string, ArrayVector>>> = {};

  for (const frame of frames) {
    if (!isTimeSeriesFrame(frame)) {
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
