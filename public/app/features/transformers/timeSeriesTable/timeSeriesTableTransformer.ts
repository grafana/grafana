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
  TransformationApplicabilityLevels
} from '@grafana/data';

/**
 * Maps a refId to a Field which contains a DataFrame.
 */
interface RefFrameFieldMap {
  [index: string]: Field<DataFrame>;
}

interface RefStringFieldMap {
  [index: string]: Field<string>;
}

interface RefNumberFieldMap {
  [index: string]: Field<number>;
}
export interface TimeSeriesTableTransformerOptions {
  refIdToStat?: Record<string, ReducerID>;
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
  const refId2LabelField: RefStringFieldMap = {};
  const refId2FrameField: RefFrameFieldMap = {};
  const refId2ValueField: RefNumberFieldMap = {}; 

  // Accumulator for our final value
  // which we'll return
  const result: DataFrame[] = [];

  // See how many refIds we have so we can properly
  // display labels
  let refIds = new Set<string>();
  for (const frame of data) {
    if (frame.refId !== undefined) {
      refIds.add(frame.refId);
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
    
    // Then initialize a new dataframe for labels and sparklines
    const table = new MutableDataFrame();

    // Retrieve the time field
    const timeField = frame.fields.find((field) => field.type === FieldType.time);

    // Initialize field for labels
    refId2LabelField[refId] = {
      name: 'Label',
      type: FieldType.string,
      config: {},
      values: [],
    };

    // Initialize field for sparklines
    refId2FrameField[refId] = {
      name: 'Trend',
      type: FieldType.frame,
      config: {},
      values: [],
    };

    // Initialize field for reductions
    refId2ValueField[refId] = {
      name: 'Value',
      type: FieldType.number,
      config: {},
      values: []
    };

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
      const reducerId = options.refIdToStat?.[refId] ?? ReducerID.lastNotNull;
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

  return result;
}
