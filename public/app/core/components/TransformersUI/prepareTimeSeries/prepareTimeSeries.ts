import {
  SynchronousDataTransformerInfo,
  DataFrame,
  FieldType,
  DataTransformerID,
  outerJoinDataFrames,
  fieldMatchers,
  FieldMatcherID,
} from '@grafana/data';
import { map } from 'rxjs/operators';

/**
 * There is currently an effort to figure out consistent names
 * for the various formats/types we produce and use.
 *
 * This transformer will eventually include the required metadata that can assert
 * a DataFrame[] is of a given type
 *
 * @internal -- TBD
 */
export enum timeSeriesFormat {
  TimeSeriesWide = 'wide', // [time,...values]
  TimeSeriesMany = 'many', // All frames have [time,number]
  //  TimeSeriesLong = 'long',
}

export type PrepareTimeSeriesOptions = {
  format: timeSeriesFormat;
};

/**
 * Convert to [][time,number]
 */
export function toTimeSeriesMany(data: DataFrame[]): DataFrame[] {
  if (!Array.isArray(data) || data.length === 0) {
    return data;
  }

  const result: DataFrame[] = [];
  for (const frame of data) {
    const timeField = frame.fields.find((field) => {
      return field.type === FieldType.time;
    });

    if (!timeField) {
      continue;
    }

    for (const field of frame.fields) {
      if (field.type !== FieldType.number) {
        continue;
      }

      result.push({
        name: frame.name,
        refId: frame.refId,
        meta: frame.meta,
        fields: [timeField, field],
        length: frame.length,
      });
    }
  }
  return result;
}

export const prepareTimeSeriesTransformer: SynchronousDataTransformerInfo<PrepareTimeSeriesOptions> = {
  id: DataTransformerID.prepareTimeSeries,
  name: 'Prepare time series',
  description: `Will stretch data frames from the wide format into the long format. This is really helpful to be able to keep backwards compatability for panels not supporting the new wide format.`,
  defaultOptions: {},

  operator: (options) => (source) =>
    source.pipe(map((data) => prepareTimeSeriesTransformer.transformer(options)(data))),

  transformer: (options: PrepareTimeSeriesOptions) => {
    const format = options?.format ?? timeSeriesFormat.TimeSeriesWide;
    if (format === timeSeriesFormat.TimeSeriesMany) {
      return toTimeSeriesMany;
    }

    return (data: DataFrame[]) => {
      // Join by the first frame
      const frame = outerJoinDataFrames({
        frames: data,
        joinBy: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
        enforceSort: true,
        keepOriginIndices: true,
      });
      return frame ? [frame] : [];
    };
  },
};
