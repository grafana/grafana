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
  TimeSeriesLong = 'long',
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
        meta: {
          ...frame.meta,
          type: DataFrameType.TimeSeriesMany,
        },
        fields: [timeField, field],
        length: frame.length,
      });
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

    const sortedUniqueLabelKeys: string[] = [];
    const uniqueFactorNames: string[] = [];
    const uniqueFactorNamesWithWideIndices: string[] = [];

    for (const labelKeys in labelKeyToWideIndices) {
      sortedUniqueLabelKeys.push(labelKeys);
    }
    for (const labelKey in uniqueLabelKeys) {
      uniqueFactorNames.push(labelKey);
    }
    for (const name in uniqueFactorNamesToWideIndex) {
      uniqueFactorNamesWithWideIndices.push(name);
    }

    sortedUniqueLabelKeys.sort();
    uniqueFactorNames.sort();
    uniqueValueNames.sort();

    const longFrame = new MutableDataFrame({
      name: frame.name,
      meta: { ...frame.meta, type: DataFrameType.TimeSeriesLong },
      fields: [{ name: timeField.name, type: timeField.type }],
    });

    for (const name of uniqueValueNames) {
      longFrame.addField({ name: name, type: uniqueValueNamesToType[name] });
    }

    for (const name of uniqueFactorNames) {
      longFrame.addField({ name: name, type: FieldType.string });
    }

    for (let wideRowIndex = 0; wideRowIndex < frame.length; wideRowIndex++) {
      const time = timeField.values.get(wideRowIndex);

      for (const labelKeys of sortedUniqueLabelKeys) {
        const rowValues: Record<string, any> = {};

        for (const name of uniqueFactorNamesWithWideIndices) {
          rowValues[name] = frame.fields[uniqueFactorNamesToWideIndex[name]].values.get(wideRowIndex);
        }

        let index = 0;

        for (const wideFieldIndex of labelKeyToWideIndices[labelKeys]) {
          const wideField = frame.fields[wideFieldIndex];

          if (index++ === 0 && wideField.labels != null) {
            for (const labelKey in wideField.labels) {
              rowValues[labelKey] = wideField.labels[labelKey];
            }
          }

          rowValues[wideField.name] = wideField.values.get(wideRowIndex);
        }

        rowValues[timeField.name] = time;
        longFrame.add(rowValues);
      }
    }

    result.push(longFrame);
  }

  return result;
}

export const prepareTimeSeriesTransformer: SynchronousDataTransformerInfo<PrepareTimeSeriesOptions> = {
  id: DataTransformerID.prepareTimeSeries,
  name: 'Prepare time series',
  description: `Will stretch data frames from the wide format into the long format. This is really helpful to be able to keep backwards compatibility for panels not supporting the new wide format.`,
  defaultOptions: {},

  operator: (options) => (source) =>
    source.pipe(map((data) => prepareTimeSeriesTransformer.transformer(options)(data))),

  transformer: (options: PrepareTimeSeriesOptions) => {
    const format = options?.format ?? timeSeriesFormat.TimeSeriesWide;
    if (format === timeSeriesFormat.TimeSeriesMany) {
      return toTimeSeriesMany;
    } else if (format === timeSeriesFormat.TimeSeriesLong) {
      return toTimeSeriesLong;
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
