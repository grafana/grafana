import { map } from 'rxjs/operators';
import tinycolor from 'tinycolor2';

import { DataTopic, FieldColor, FieldColorModeId } from '@grafana/schema';
import { colors } from '@grafana/ui';

import { DataFrame, Field, FieldType } from '../../types/dataFrame';
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
  color?: string;
}

export interface OptionalAnnotationOptions {
  frameName?: string;
  colorScheme?: FieldColor;
}

export type AnnotationFieldMapping = OptionalAnnotationFields & RequiredAnnotationFields;

export interface ConvertFrameTypeTransformerOptions {
  targetType?: FrameType;
  annotationFieldMapping?: AnnotationFieldMapping;
  annotationOptions?: OptionalAnnotationOptions;
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
    return frames.map((frame, frameIdx) => convertSeriesToAnnotation(frame, frameIdx, options));
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

const createColorField = (frame: DataFrame, color: string): Field => {
  const startTimeField = frame.fields.find((field) => field.type === FieldType.time && field.name === 'time');
  return {
    config: {},
    name: 'color',
    type: FieldType.string,
    values: new Array(startTimeField?.values.length).fill(color),
  };
};

function mapSourceFieldNameToAnnoFieldName(
  options: ConvertFrameTypeTransformerOptions,
  sourceFieldName: string | undefined
) {
  const annotationFieldMappingValues = Object.values(options?.annotationFieldMapping ?? []);
  const annotationFieldMappingKeys = Object.keys(options?.annotationFieldMapping ?? []);
  const idx = annotationFieldMappingValues.findIndex((fieldName: AnnotationFieldMapping) => {
    return sourceFieldName === fieldName;
  });

  if (idx !== -1) {
    return annotationFieldMappingKeys[idx];
  }

  return undefined;
}

function convertSeriesToAnnotation(
  frame: DataFrame,
  frameIdx: number,
  options: ConvertFrameTypeTransformerOptions
): DataFrame {
  // TODO: ensure time field
  // TODO: ensure value field

  // get rid of default color, use color
  let frameName = undefined;
  if (options.annotationOptions?.frameName) {
    const sourceFieldForFrameName = frame.fields.find((field) => field.name === options.annotationOptions?.frameName);
    const nameSet = new Set(sourceFieldForFrameName?.values);
    if (nameSet.size > 1) {
      // There can be only one!! @todo
      console.warn('should only be a single unique value in source frameName field');
    }

    frameName = sourceFieldForFrameName?.values[0];
  }

  const annoFields: Field[] = frame.fields
    .filter((sourceField) => {
      const name = mapSourceFieldNameToAnnoFieldName(options, sourceField.name);
      return !!name;
    })
    .map((sourceField) => {
      const name = mapSourceFieldNameToAnnoFieldName(options, sourceField.name) ?? sourceField.name;
      if (name === 'tags') {
        return { ...sourceField, name, values: [...sourceField.values.map((v) => (Array.isArray(v) ? v : [v]))] };
      }
      return {
        ...sourceField,
        name,
      };
    });

  const mappedFrame: DataFrame = {
    ...frame,
    name: frameName ?? frame.name ?? Math.random().toString(),
    fields: [...frame.fields, ...annoFields],
    meta: {
      ...frame.meta,
      dataTopic: DataTopic.Annotations,
    },
  };

  // Currently creating custom "complement" palette
  let color = annotationPalette[frameIdx % annotationPalette.length];
  // @todo support other color schemes besides fixed
  if (
    options.annotationOptions?.colorScheme?.mode === FieldColorModeId.Fixed &&
    options.annotationOptions?.colorScheme.fixedColor
  ) {
    color = options.annotationOptions?.colorScheme.fixedColor;
  }

  const colorField = createColorField(mappedFrame, color);
  const fields = [...mappedFrame.fields, { ...createIsRegionField(mappedFrame) }, { ...colorField }];

  return {
    ...mappedFrame,
    fields,
    meta: {
      ...frame.meta,
      dataTopic: DataTopic.Annotations,
    },
  };
}

export const annotationPalette = colors.map((color) => {
  const tinyColor = tinycolor(color).complement();
  return tinyColor.toHexString();
});
