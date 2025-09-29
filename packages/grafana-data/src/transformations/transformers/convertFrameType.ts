import { map } from 'rxjs/operators';

import { DataTopic } from '@grafana/schema';

import { DataFrame, FieldType } from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

/*
"schema": {
  "meta": {
    "custom": {
      "resultType": "exemplar"
    }
  },
*/

// ResultType?

export enum FrameType {
  Exemplar = 'exemplar',
  TimeRegion = 'timeRegion',
  Annotation = 'annotation',
}

export interface RequiredAnnotationFields {
  text?: string;
  time?: string;
}

export interface OptionalAnnotationFields {
  title?: string;
  timeEnd?: string;
  tags?: string;
  id?: string;
}

export type AnnotationFieldMapping = OptionalAnnotationFields & RequiredAnnotationFields;

export interface ConvertFrameTypeTransformerOptions {
  targetType?: FrameType;
  annotationFieldMapping?: AnnotationFieldMapping;
}

/** @alpha */
export const convertFrameTypeTransformer: DataTransformerInfo<ConvertFrameTypeTransformerOptions> = {
  id: DataTransformerID.convertFrameType,
  name: 'Convert frame type',
  description: 'Convert data frame(s) to another type.',

  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        return convertFrameTypes(options, data);
      })
    ),
};

/**
 * Convert frame data topics for dataframe(s)
 * @param options - frame type conversion options
 * @param frames - dataframe(s) to convert
 * @returns dataframe(s) with converted frame types
 *
 * @todo convertSeriesToAnnotation not working with regions
 */
export function convertFrameTypes(options: ConvertFrameTypeTransformerOptions, frames: DataFrame[]): DataFrame[] {
  const { targetType } = options;
  if (targetType === FrameType.Exemplar) {
    return frames.map(convertSeriesToExemplar);
  }
  if (targetType === FrameType.Annotation) {
    return frames.map(convertSeriesToAnnotation);
  }
  return frames;
}

/**
 * Convert a series DataFrame to annotations format suitable for exemplars
 * @param frame - series DataFrame to convert
 * @returns DataFrame formatted as annotations/exemplars
 */
function convertSeriesToExemplar(frame: DataFrame): DataFrame {
  // TODO: ensure time field
  // TODO: ensure value field

  return {
    ...frame,
    name: 'exemplar',
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

/**
 * Generate isRegion field from anno frame
 * Requires 'time' and 'timeEnd' field names in source frame
 */
const createIsRegionField = (frame: DataFrame) => {
  const timeFields = frame.fields.filter((field) => field.type === FieldType.time);
  const startTimeField = timeFields.find((field) => field.name === 'time');
  const timeEndField = timeFields.find((field) => field.name === 'timeEnd');
  const isRegionValues: boolean[] =
    startTimeField?.values.map((v, idx) => {
      const timeEnd = timeEndField?.values?.[idx];
      return timeEnd && v !== timeEnd?.values?.[idx];
    }) ?? [];

  return {
    config: {},
    name: 'isRegion',
    type: FieldType.boolean,
    values: isRegionValues,
  };
};

function convertSeriesToAnnotation(frame: DataFrame): DataFrame {
  // TODO: ensure time field
  // TODO: ensure value field
  // @todo general mapping from source fields to anno fields?

  return {
    ...frame,
    fields: [...frame.fields, createIsRegionField(frame)],
    meta: {
      ...frame.meta,
      dataTopic: DataTopic.Annotations,
    },
  };
}
