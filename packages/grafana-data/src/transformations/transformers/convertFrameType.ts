import { map } from 'rxjs/operators';

import { DataTopic } from '@grafana/schema';

import { DataFrame } from '../../types/dataFrame';
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

export interface ConvertFrameTypeTransformerOptions {
  targetType?: FrameType;
}

/** @alpha */
export const convertFrameTypeTransformer: DataTransformerInfo<ConvertFrameTypeTransformerOptions> = {
  id: DataTransformerID.convertFrameType,
  name: 'Convert frame type',
  description: 'Convert data frame(s) to another type.',

  operator: (options, ctx) => (source) => source.pipe(map((data) => {
    // console.log(data);
    return convertFrameTypes(options, data);
  })),
};

/**
 * Convert frame data topics for dataframe(s)
 * @param options - frame type conversion options
 * @param frames - dataframe(s) to convert
 * @returns dataframe(s) with converted frame types
 */
export function convertFrameTypes(options: ConvertFrameTypeTransformerOptions, frames: DataFrame[]): DataFrame[] {
  const { targetType } = options;
  return targetType === FrameType.Exemplar ? frames.map(convertSeriesToExemplar) : frames;
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
