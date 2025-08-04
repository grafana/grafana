import { map } from 'rxjs/operators';

import { DataTopic } from '@grafana/schema';

import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { SynchronousDataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

export interface ConvertFrameTypeTransformerOptions {
  targetDataTopic: DataTopic;
}

export const convertFrameTypeTransformer: SynchronousDataTransformerInfo<ConvertFrameTypeTransformerOptions> = {
  id: DataTransformerID.convertFrameType,
  name: 'Convert frame type',
  description: 'Convert frame data topic.',
  defaultOptions: {
    targetDataTopic: DataTopic.Annotations,
  },

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => convertFrameTypeTransformer.transformer(options, ctx)(data))),

  transformer: (options: ConvertFrameTypeTransformerOptions) => (data: DataFrame[]) => {
    if (!Array.isArray(data) || data.length === 0) {
      return data;
    }
    return convertFrameTypes(options, data);
  },
};

/**
 * Convert frame data topics for dataframe(s)
 * @param options - frame type conversion options
 * @param frames - dataframe(s) to convert
 * @returns dataframe(s) with converted frame types
 */
export function convertFrameTypes(options: ConvertFrameTypeTransformerOptions, frames: DataFrame[]): DataFrame[] {
  const { targetDataTopic = DataTopic.Annotations } = options;

  const convertedFrames: DataFrame[] = [];

  for (const frame of frames) {
    if (!frame || !frame.fields.length) {
      continue;
    }

    const currentDataTopic = frame.meta?.dataTopic || DataTopic.Series;
    const isAlreadyExemplar = frame.meta?.custom?.resultType === 'exemplar';
    const isAlreadyAnnotation = currentDataTopic === DataTopic.Annotations;

    const shouldConvert =
      targetDataTopic === DataTopic.Annotations &&
      currentDataTopic === DataTopic.Series &&
      !isAlreadyExemplar &&
      !isAlreadyAnnotation;

    convertedFrames.push(frame);

    if (shouldConvert) {
      try {
        const convertedFrame = convertSeriesToAnnotations(frame);
        convertedFrames.push(convertedFrame);
      } catch (error) {
        console.warn(`Failed to convert "${frame.name}" to annotations:`, error);
      }
    }
  }

  return convertedFrames;
}

/**
 * Convert a series DataFrame to annotations format suitable for exemplars
 * @param frame - series DataFrame to convert
 * @returns DataFrame formatted as annotations/exemplars
 */
function convertSeriesToAnnotations(frame: DataFrame): DataFrame {
  const timeField = frame.fields.find((field) => field.type === FieldType.time);
  const valueFields = frame.fields.filter((field) => field.type === FieldType.number && field !== timeField);
  const labelFields = frame.fields.filter(
    (field) => field.type === FieldType.string || (field.labels && Object.keys(field.labels).length > 0)
  );

  if (!timeField) {
    throw new Error('Time field is required for conversion to annotations');
  }

  // @TODO: ??
  const annotationFields: Field[] = [];

  // Add time field
  annotationFields.push({
    ...timeField,
    name: 'time',
  });

  // Add value field (use first numeric field or create default)
  if (valueFields.length > 0) {
    annotationFields.push({
      ...valueFields[0],
      name: 'value',
    });
  } else {
    annotationFields.push({
      name: 'value',
      type: FieldType.number,
      config: {},
      values: timeField.values.map(() => 1),
    });
  }

  // Add label fields for exemplar linking (avoid duplicates)
  const addedLabelNames = new Set<string>();

  for (const labelField of labelFields) {
    if (labelField.labels) {
      for (const [labelKey, labelValue] of Object.entries(labelField.labels)) {
        if (!addedLabelNames.has(labelKey)) {
          annotationFields.push({
            name: labelKey,
            type: FieldType.string,
            config: {},
            values: timeField.values.map(() => labelValue),
          });
          addedLabelNames.add(labelKey);
        }
      }
    } else if (labelField.type === FieldType.string && !addedLabelNames.has(labelField.name)) {
      annotationFields.push({
        ...labelField,
      });
      addedLabelNames.add(labelField.name);
    }
  }

  // Text field for annotation content
  const textField: Field = {
    name: 'text',
    type: FieldType.string,
    config: {},
    values: timeField.values.map((_, index) => {
      const valueText = valueFields.length > 0 ? `Value: ${valueFields[0].values[index]}` : 'Exemplar';
      const frameNameText = frame.name ? ` (${frame.name})` : '';
      return `${valueText}${frameNameText}`;
    }),
  };
  annotationFields.push(textField);

  // Tags field for categorization
  const tagsField: Field = {
    name: 'tags',
    type: FieldType.string,
    config: {},
    values: timeField.values.map(() => frame.name || 'exemplar'),
  };
  annotationFields.push(tagsField);

  return {
    name: 'exemplar',
    refId: frame.refId,
    fields: annotationFields,
    length: timeField.values.length,
    meta: {
      ...frame.meta,
      dataTopic: DataTopic.Annotations,
      custom: {
        ...frame.meta?.custom,
        resultType: 'exemplar',
      },
    },
  };
}
