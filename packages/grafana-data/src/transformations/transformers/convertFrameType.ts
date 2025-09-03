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

  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        return convertFrameType(options, data);
      })
    ),
};

function convertFrameType(options: ConvertFrameTypeTransformerOptions, frames: DataFrame[]): DataFrame[] {
  const { targetType } = options;
  return targetType === FrameType.Exemplar ? frames.map(convertSeriesToExemplar) : frames;
}

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
