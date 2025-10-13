import { map } from 'rxjs/operators';

import {
  SynchronousDataTransformerInfo,
  DataFrame,
  DataFrameType,
  FieldType,
  DataTransformerID,
  outerJoinDataFrames,
  fieldMatchers,
  FieldMatcherID,
  Field,
  MutableDataFrame,
} from '@grafana/data';
import { Labels } from 'app/types/unified-alerting-dto';

import { partitionByValues } from '../partitionByValues/partitionByValues';

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
  TimeSeriesWide = 'wide',
  TimeSeriesLong = 'long',
  TimeSeriesMulti = 'multi',

  /** @deprecated use multi */
  TimeSeriesMany = 'many',
}

export type PrepareTimeSeriesOptions = {
  format: timeSeriesFormat;
};

/**
 * Convert to [][time,number]
 */
export function toTimeSeriesMulti(data: DataFrame[]): DataFrame[] {
  if (!Array.isArray(data) || data.length === 0) {
    return data;
  }

  const result: DataFrame[] = [];
  for (const frame of toTimeSeriesLong(data)) {
    const timeField = frame.fields[0];
    if (!timeField || timeField.type !== FieldType.time) {
      continue;
    }
    const valueFields: Field[] = [];
    const labelFields: Field[] = [];
    for (const field of frame.fields) {
      switch (field.type) {
        case FieldType.number:
        case FieldType.boolean:
          valueFields.push(field);
          break;
        case FieldType.string:
          labelFields.push(field);
          break;
      }
    }

    for (const field of valueFields) {
      if (labelFields.length) {
        // new frame for each label key
        type frameBuilder = {
          time: number[];
          value: number[];
          key: string;
          labels: Labels;
        };
        const builders = new Map<string, frameBuilder>();
        for (let i = 0; i < frame.length; i++) {
          const time = timeField.values[i];
          const value = field.values[i];
          if (value === undefined || time == null) {
            continue; // skip values left over from join
          }

          const key = labelFields.map((f) => f.values[i]).join('/');
          let builder = builders.get(key);
          if (!builder) {
            builder = {
              key,
              time: [],
              value: [],
              labels: {},
            };
            for (const label of labelFields) {
              builder.labels[label.name] = label.values[i];
            }
            builders.set(key, builder);
          }
          builder.time.push(time);
          builder.value.push(value);
        }

        // Add a frame for each distinct value
        for (const b of builders.values()) {
          result.push({
            name: frame.name,
            refId: frame.refId,
            meta: {
              ...frame.meta,
              type: DataFrameType.TimeSeriesMulti,
            },
            fields: [
              {
                ...timeField,
                values: b.time,
              },
              {
                ...field,
                values: b.value,
                labels: b.labels,
              },
            ],
            length: b.time.length,
          });
        }
      } else {
        result.push({
          name: frame.name,
          refId: frame.refId,
          meta: {
            ...frame.meta,
            type: DataFrameType.TimeSeriesMulti,
          },
          fields: [timeField, field],
          length: frame.length,
        });
      }
    }
  }
  return result;
}

export function toTimeSeriesLong(data: DataFrame[]): DataFrame[] {
  if (!Array.isArray(data) || data.length === 0) {
    return data;
  }

  const result: DataFrame[] = [];
  for (const frame of data) {
    let timeField: Field | undefined;
    const uniqueValueNames: string[] = [];
    const uniqueValueNamesToType: Record<string, FieldType> = {};
    const uniqueLabelKeys: Record<string, boolean> = {};
    const labelKeyToWideIndices: Record<string, number[]> = {};
    const uniqueFactorNamesToWideIndex: Record<string, number> = {};

    for (let fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
      const field = frame.fields[fieldIndex];

      switch (field.type) {
        case FieldType.string:
        case FieldType.boolean:
          if (field.name in uniqueFactorNamesToWideIndex) {
            // TODO error?
          } else {
            uniqueFactorNamesToWideIndex[field.name] = fieldIndex;
            uniqueLabelKeys[field.name] = true;
          }
          break;
        case FieldType.time:
          if (!timeField) {
            timeField = field;
            break;
          }
        default:
          if (field.name in uniqueValueNamesToType) {
            const type = uniqueValueNamesToType[field.name];

            if (field.type !== type) {
              // TODO error?
              continue;
            }
          } else {
            uniqueValueNamesToType[field.name] = field.type;
            uniqueValueNames.push(field.name);
          }

          const tKey = JSON.stringify(field.labels);
          const wideIndices = labelKeyToWideIndices[tKey];

          if (wideIndices !== undefined) {
            wideIndices.push(fieldIndex);
          } else {
            labelKeyToWideIndices[tKey] = [fieldIndex];
          }

          if (field.labels != null) {
            for (const labelKey in field.labels) {
              uniqueLabelKeys[labelKey] = true;
            }
          }
      }
    }

    if (!timeField) {
      continue;
    }

    type TimeWideRowIndex = {
      time: any;
      wideRowIndex: number;
    };
    const sortedTimeRowIndices: TimeWideRowIndex[] = [];
    const sortedUniqueLabelKeys: string[] = [];
    const uniqueFactorNames: string[] = [];
    const uniqueFactorNamesWithWideIndices: string[] = [];

    for (let wideRowIndex = 0; wideRowIndex < frame.length; wideRowIndex++) {
      sortedTimeRowIndices.push({ time: timeField.values[wideRowIndex], wideRowIndex: wideRowIndex });
    }

    for (const labelKeys in labelKeyToWideIndices) {
      sortedUniqueLabelKeys.push(labelKeys);
    }
    for (const labelKey in uniqueLabelKeys) {
      uniqueFactorNames.push(labelKey);
    }
    for (const name in uniqueFactorNamesToWideIndex) {
      uniqueFactorNamesWithWideIndices.push(name);
    }

    sortedTimeRowIndices.sort((a, b) => a.time - b.time);
    sortedUniqueLabelKeys.sort();
    uniqueFactorNames.sort();
    uniqueValueNames.sort();

    const longFrame = new MutableDataFrame({
      ...frame,
      meta: { ...frame.meta, type: DataFrameType.TimeSeriesLong },
      fields: [{ name: timeField.name, type: timeField.type }],
    });

    for (const name of uniqueValueNames) {
      longFrame.addField({ name: name, type: uniqueValueNamesToType[name] });
    }

    for (const name of uniqueFactorNames) {
      longFrame.addField({ name: name, type: FieldType.string });
    }

    for (const timeWideRowIndex of sortedTimeRowIndices) {
      const { time, wideRowIndex } = timeWideRowIndex;

      for (const labelKeys of sortedUniqueLabelKeys) {
        const rowValues: Record<string, any> = {};

        for (const name of uniqueFactorNamesWithWideIndices) {
          rowValues[name] = frame.fields[uniqueFactorNamesToWideIndex[name]].values[wideRowIndex];
        }

        let index = 0;

        for (const wideFieldIndex of labelKeyToWideIndices[labelKeys]) {
          const wideField = frame.fields[wideFieldIndex];

          if (index++ === 0 && wideField.labels != null) {
            for (const labelKey in wideField.labels) {
              rowValues[labelKey] = wideField.labels[labelKey];
            }
          }

          rowValues[wideField.name] = wideField.values[wideRowIndex];
        }

        rowValues[timeField.name] = time;
        longFrame.add(rowValues);
      }
    }

    result.push(longFrame);
  }

  return result;
}

export function longToMultiTimeSeries(frame: DataFrame): DataFrame[] {
  // All the string fields
  const matcher = (field: Field) => field.type === FieldType.string;

  // transform one dataFrame at a time and concat into DataFrame[]
  return partitionByValues(frame, matcher).map((frame) => {
    if (!frame.meta) {
      frame.meta = {};
    }
    frame.meta.type = DataFrameType.TimeSeriesMulti;
    return frame;
  });
}

export const prepareTimeSeriesTransformer: SynchronousDataTransformerInfo<PrepareTimeSeriesOptions> = {
  id: DataTransformerID.prepareTimeSeries,
  name: 'Prepare time series',
  description: `Will stretch data frames from the wide format into the long format. This is really helpful to be able to keep backwards compatibility for panels not supporting the new wide format.`,
  defaultOptions: {},

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => prepareTimeSeriesTransformer.transformer(options, ctx)(data))),

  transformer: (options: PrepareTimeSeriesOptions) => {
    const format = options?.format ?? timeSeriesFormat.TimeSeriesWide;
    if (format === timeSeriesFormat.TimeSeriesMany || format === timeSeriesFormat.TimeSeriesMulti) {
      return toTimeSeriesMulti;
    } else if (format === timeSeriesFormat.TimeSeriesLong) {
      return toTimeSeriesLong;
    }
    const joinBy = fieldMatchers.get(FieldMatcherID.firstTimeField).get({});

    // Single TimeSeriesWide frame (joined by time)
    return (data: DataFrame[]) => {
      if (!data.length) {
        return [];
      }

      // Convert long to wide first
      const join: DataFrame[] = [];
      for (const df of data) {
        if (df.meta?.type === DataFrameType.TimeSeriesLong) {
          longToMultiTimeSeries(df).forEach((v) => join.push(v));
        } else {
          join.push(df);
        }
      }

      // Join by the first frame
      const frame = outerJoinDataFrames({
        frames: join,
        joinBy,
        keepOriginIndices: true,
      });
      if (frame) {
        if (!frame.meta) {
          frame.meta = {};
        }
        frame.meta.type = DataFrameType.TimeSeriesWide;
        return [frame];
      }
      return [];
    };
  },
};
