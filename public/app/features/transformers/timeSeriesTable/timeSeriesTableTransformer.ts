import { map } from 'rxjs/operators';

import {
  DataFrame,
  DataTransformerID,
  DataTransformerInfo,
  DataFrameWithValue,
  Field,
  FieldType,
  MutableDataFrame,
  isTimeSeriesFrame,
  ReducerID,
  reduceField,
  TransformationApplicabilityLevels,
  isTimeSeriesField,
} from '@grafana/data';
import { t } from '@grafana/i18n';

/**
 * Maps a refId to a Field which can contain
 * different types of data. In our case we
 * care about DataFrame, number, and string.
 */
interface RefFieldMap<T> {
  [index: string]: Field<T>;
}

/**
 * A map of RefIds to labels where each
 * label maps to a field of the given
 * type. It's technically possible
 * to use the above type to achieve
 * this in combination with another mapping
 * but the RefIds are on the outer map
 * in this case, so we use a different type
 * to avoid future issues.
 *
 *  RefId: {
 *     label1: Field<T>
 *     label2: Field<T>
 *  }
 */
interface RefLabelFieldMap<T> {
  [index: string]: {
    [index: string]: Field<T>;
  };
}

/**
 * For options we have a set of options
 * for each refId. So we map the refId
 * for each setting.
 */
export interface TimeSeriesTableTransformerOptions {
  [index: string]: RefIdTransformerOptions;
}

/**
 * Counts the number of refId frames in
 * a given frame array. i.e.
 *  {
 *    A: 10
 *    B: 20
 *    C: 12
 *  }
 */
interface RefCount {
  [index: string]: number;
}

/**
 * For each refId we allow the following to
 * be configured:
 *
 *  - stat: A stat to calculate for the refId
 *  - mergeSeries: Whether separate series should be merged into one
 *  - timeField: The time field that should be used for the time series
 */
export interface RefIdTransformerOptions {
  stat?: ReducerID;
  timeField?: string;
  inlineStat?: boolean;
}

export const getTimeSeriesTableTransformer: () => DataTransformerInfo<TimeSeriesTableTransformerOptions> = () => ({
  id: DataTransformerID.timeSeriesTable,
  name: t('transformers.time-series-table.name.time-series-to-table', 'Time series to table'),
  description: t(
    'transformers.time-series-table.description.convert-to-table-rows',
    'Convert time series data to table rows so that they can be viewed in tabular or sparkline format.'
  ),
  defaultOptions: {},
  isApplicable: (data) => {
    for (const frame of data) {
      if (isTimeSeriesFrame(frame)) {
        return TransformationApplicabilityLevels.Applicable;
      }
    }

    return TransformationApplicabilityLevels.NotApplicable;
  },
  isApplicableDescription: t(
    'transformers.time-series-table.is-applicable-description.requires-time-series-frame',
    'The Time series to table transformation requires at least one time series frame to function. You currently have none.'
  ),
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        return timeSeriesToTableTransform(options, data);
      })
    ),
});

/**
 * Converts time series frames to table frames for use with sparkline chart type.
 *
 * @remarks
 * For each refId (queryName) convert all time series frames into a single table frame, adding each series
 * as values of a "Trend" frame field. This allows "Trend" to be rendered as area chart type.
 *
 * Any non time series frames are returned unmodified.
 *
 * @param options - Transform options, currently not used
 * @param data - Array of data frames to transform
 * @returns Array of transformed data frames
 *
 * @beta
 */
export function timeSeriesToTableTransform(options: TimeSeriesTableTransformerOptions, data: DataFrame[]): DataFrame[] {
  // Initialize maps for labels, sparklines, and reduced values
  const refId2trends: RefLabelFieldMap<DataFrameWithValue> = {};
  const refId2labelz: RefLabelFieldMap<string> = {};

  // Accumulator for our final value
  // which we'll return
  const result: DataFrame[] = [];

  // Retreive the refIds of all the data
  let refIdMap = getRefData(data);

  // If we're merging data then rather
  // than creating a series per source
  // series we initialize fields here
  // so we end up with one
  for (const refId of Object.keys(refIdMap)) {
    // Get the frames with the current refId
    const framesForRef = data.filter((frame) => frame.refId === refId);

    // Intialize object for this refId
    refId2trends[refId] = {};

    // Initialize labels object for this refId
    refId2labelz[refId] = {};

    // Collect all existing label names across frames
    // so we can fill in nulls for frames that don't
    // have a particular label
    const labelNames: string[] = [];

    framesForRef.forEach((frame) => {
      frame.fields.forEach((field) => {
        if (field.type !== FieldType.number) {
          return;
        }
        if (field.labels) {
          Object.keys(field.labels).forEach((labelName) => {
            if (!labelNames.includes(labelName)) {
              refId2labelz[refId][labelName] = newField(labelName, FieldType.string);
              labelNames.push(labelName);
            }
          });
        }
      });
    });

    for (let i = 0; i < framesForRef.length; i++) {
      const frame = framesForRef[i];

      // Retrieve the time field that's been configured
      // If one isn't configured then use the first found
      let timeField = null;
      let timeFieldName = options[refId]?.timeField;
      if (timeFieldName && timeFieldName.length > 0) {
        timeField = frame.fields.find((field) => field.name === timeFieldName);
      } else {
        timeField = frame.fields.find((field) => isTimeSeriesField(field));
      }

      // If it's not a time series frame we add
      // it unmodified to the result
      if (!isTimeSeriesFrame(frame)) {
        result.push(frame);
        continue;
      }

      for (const field of frame.fields) {
        // Skip non-number based fields
        // i.e. we skip time, strings, etc.
        if (field.type !== FieldType.number) {
          continue;
        }

        // Calculate the reduction of the current field
        // and push the frame with reduction
        // into the appropriate field
        const reducerId = options[refId]?.stat ?? ReducerID.lastNotNull;
        const value = reduceField({ field, reducers: [reducerId] })[reducerId] ?? null;

        // Push the appropriate time and value frame
        // to the trend frame for the sparkline
        const sparklineFrame = new MutableDataFrame();
        if (timeField !== undefined) {
          sparklineFrame.addField(timeField);
          sparklineFrame.addField(field);

          if (refId2trends[refId][`Trend #${refId}`] === undefined) {
            refId2trends[refId][`Trend #${refId}`] = newField(`Trend #${refId}`, FieldType.frame);
          }

          refId2trends[refId][`Trend #${refId}`].values.push({
            ...sparklineFrame,
            value,
            length: field.values.length,
          });
        }

        // If there are labels add them to the appropriate fields
        // Because we iterate each frame
        labelNames.forEach((labelName) => {
          refId2labelz[refId][labelName].values.push(field.labels?.[labelName] ?? '');
        });
      }
    }
  }

  for (const refId of Object.keys(refIdMap)) {
    const label2fields: RefFieldMap<string> = {};

    // Allocate a new frame
    const table = new MutableDataFrame();
    table.refId = refId;

    // Rather than having a label fields for each refId
    // we combine them into a single set of labels
    // taking the first value available
    const labels = refId2labelz[refId];
    if (labels !== undefined) {
      for (const [labelName, labelField] of Object.entries(labels)) {
        if (label2fields[labelName] === undefined) {
          label2fields[labelName] = labelField;
        }
      }
    }

    // Add label fields to the resulting frame
    for (const label of Object.values(label2fields)) {
      table.addField(label);
    }

    // Add trend fields to frame
    const refTrends = refId2trends[refId];
    for (const trend of Object.values(refTrends)) {
      table.addField(trend);
    }

    // Finaly push to the result
    if (table.fields.length > 0) {
      result.push(table);
    }
  }

  return result;
}

/**
 * Create a new field with the given label and type.
 *
 * @param label
 *  The string label for the field.
 * @param type
 *  The type fo the field (e.g. number, boolean, etc.)
 * @returns
 *  A new Field"
 */
function newField(label: string, type: FieldType) {
  return {
    name: label,
    type: type,
    config: {},
    values: [],
  };
}

/**
 * Get the refIds contained in an array of Data frames.
 * @param data
 * @returns A RefCount object
 */
export function getRefData(data: DataFrame[]) {
  let refMap: RefCount = {};
  for (const frame of data) {
    if (frame.refId !== undefined) {
      if (refMap[frame.refId] === undefined) {
        refMap[frame.refId] = 1;
      } else {
        refMap[frame.refId]++;
      }
    }
  }

  return refMap;
}
