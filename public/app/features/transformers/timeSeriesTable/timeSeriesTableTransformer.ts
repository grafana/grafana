import { map } from 'rxjs/operators';

import {
  DataFrame,
  DataTransformerID,
  DataTransformerInfo,
  Field,
  FieldType,
  MutableDataFrame,
  isTimeSeriesFrame,
  ReducerID,
  reduceField,
  TransformationApplicabilityLevels,
} from '@grafana/data';

/**
 * Maps a refId to a Field which can contain
 * different types of data. In our case we 
 * care about DataFrame, number, and string.
 */
interface RefFieldMap<T> {
  [index: string]: Field<T>;
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
 * For each refId we allow the following to
 * be configured:
 * 
 *  - stat: A stat to calculate for the refId
 *  - mergeSeries: Whether separate series should be merged into one
 *  - timeField: The time field that should be used for the time series
 */
interface RefIdTransformerOptions {
  stat?: ReducerID;
  mergeSeries?: boolean,
  timeField?: string,
}

export const timeSeriesTableTransformer: DataTransformerInfo<TimeSeriesTableTransformerOptions> = {
  id: DataTransformerID.timeSeriesTable,
  name: 'Time series to table',
  description: 'Convert time series data to table rows so that they can be viewed in tabular or sparkline format.',
  defaultOptions: {},
  isApplicable: (data) => {
    for (const frame of data) {
      if (isTimeSeriesFrame(frame)) {
        return TransformationApplicabilityLevels.Applicable;
      }
    }

    return TransformationApplicabilityLevels.NotApplicable;
  },
  isApplicableDescription: 'The Time series to table transformation requires at least one time series frame to function. You currently have none.',    
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
  const refId2LabelField: RefFieldMap<string> = {};
  const refId2FrameField: RefFieldMap<DataFrame> = {};
  const refId2ValueField: RefFieldMap<number> = {};

  // Whether we're going to merge together the resulting 
  // frames (the default) or leave them alone
  const merge = false;//options.mergeSeries !== undefined ? options.mergeSeries : true;

  // Accumulator for our final value
  // which we'll return
  const result: DataFrame[] = [];

  // See how many refIds we have so we can properly
  // display labels
  let refIds = getRefIds(data);

  // If we're merging data then rather
  // than creating a series per source 
  // series we initialize fields here
  // so we end up with one
  for (const refId of refIds) {
    const merge = options[refId]?.mergeSeries !== undefined ? options[refId].mergeSeries : true;
    if (merge) {
      refId2LabelField[refId] = newField('Label', FieldType.string);
      refId2FrameField[refId] = newField('Trend', FieldType.frame);
      refId2ValueField[refId] = newField('Trend Value', FieldType.number);
    }
  } 


  for (const frame of data) {
    // If it's not a time series frame we add
    // it unmodified to the result
    if (!isTimeSeriesFrame(frame)) {
      result.push(frame);
      continue;
    }

    // Grab the current refId and the corresponding label fields
    const refId = frame.refId ?? '';

    // Retrieve the time field that's been configured
    // If one isn't configured then use the first found
    let timeField = null;
    if (options[refId]?.timeField !== undefined) {
      timeField = frame.fields.find((field) => field.name === options[refId]?.timeField);
    } else {
      timeField = frame.fields.find((field) => field.type === FieldType.time);
    }

    // Initialize fields for this frame 
    // if we're not merging them
    const merge = options[refId]?.mergeSeries !== undefined ? options[refId].mergeSeries : true;
    if (!merge) {
      refId2LabelField[refId] = newField('Label', FieldType.string);
      refId2FrameField[refId] = newField('Trend', FieldType.frame);
      refId2ValueField[refId] = newField('Trend Value', FieldType.number);
    }

    for (const field of frame.fields) {
      // Skip non-number based fields
      // i.e. we skip time, strings, etc.
      if (field.type !== FieldType.number) {
        continue;
      }

      // Create the value for the label field
      let labelParts: string[] = [];

      // Add the refId to the label if we have 
      // more than one
      if (refIds.size > 1) {
        labelParts.push(refId);
      }

      // Add the name of the field
      labelParts.push(field.name);

      // If there is any labeled data add it here
      if (field.labels !== undefined) {
        for (const [labelKey, labelValue] of Object.entries(field.labels as object)) {
          labelParts.push(`${labelKey}=${labelValue}`);
        }
      }

      // Add the label parts to the label field
      const label = labelParts.join(' : ');
      refId2LabelField[refId].values.push(label);

      // Calculate the reduction of the current field
      // and push the frame with reduction 
      // into the the appropriate field
      const reducerId = options[refId]?.stat ?? ReducerID.lastNotNull;
      const value = reduceField({ field, reducers: [reducerId] })[reducerId] || null;
      refId2ValueField[refId].values.push(value);

      // Push the appropriate time and value frame
      // to the trend frame for the sparkline
      const sparklineFrame = new MutableDataFrame();
      if (timeField !== undefined) {
        sparklineFrame.addField(timeField);
        sparklineFrame.addField(field);
      }
      refId2FrameField[refId].values.push(sparklineFrame);
    }

    if (!merge) {
      // Then initialize a new dataframe for labels and sparklines
      const table = new MutableDataFrame();

      // Set the refId
      table.refId = refId;

      // Add the label, sparkline, and value fields
      // into the new frame
      table.addField(refId2LabelField[refId]);
      table.addField(refId2FrameField[refId]);
      table.addField(refId2ValueField[refId]);

      // Finaly push to the result
      result.push(table);
    }
  }

  // If we're merging create the final result
  for (const refId of refIds) {
    const merge = options[refId]?.mergeSeries !== undefined ? options[refId].mergeSeries : true;
    if (merge) {
    // Then initialize a new dataframe for labels and sparklines
      const table = new MutableDataFrame();

      // Set the refId
      table.refId = refId;

      // Add the label, sparkline, and value fields
      // into the new frame
      table.addField(refId2LabelField[refId]);
      table.addField(refId2FrameField[refId]);
      table.addField(refId2ValueField[refId]);

      // Finaly push to the result
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
    values: []
  };
}

/**
 * Get the refIds contained in an array of Data frames.
 * @param data 
 * @returns 
 */
export function getRefIds(data: DataFrame[]) {
  let refIds = new Set<string>();
  for (const frame of data) {
    if (frame.refId !== undefined) {
      refIds.add(frame.refId);
    }
  }

  return refIds;
}
