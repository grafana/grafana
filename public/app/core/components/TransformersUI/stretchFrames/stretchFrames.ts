import { map } from 'rxjs/operators';
import { DataTransformerInfo, DataFrame, FieldType } from '@grafana/data';

export type StretchFramesTransformerOptions = {};

export function stretchFrames(data: DataFrame[]): DataFrame[] {
  if (!Array.isArray(data) || data.length === 0) {
    return data;
  }

  const result: DataFrame[] = [];

  for (const frame of data) {
    const timeField = frame.fields.find((field) => {
      return field.type === FieldType.time;
    });

    if (!timeField || frame.fields.length === 2) {
      result.push(frame);
      continue;
    }

    for (const field of frame.fields) {
      if (field === timeField) {
        continue;
      }

      result.push({
        name: withIndex(frame.name, result.length),
        refId: withIndex(frame.refId, result.length),
        fields: [timeField, field],
        length: frame.length,
        meta: frame.meta,
      });
    }
  }

  return result;
}

export const stretchFramesTransformer: DataTransformerInfo<StretchFramesTransformerOptions> = {
  id: 'stretchFrames',
  name: 'Stretch frames',
  description: 'Stretch a set of data frames from wide to long',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  operator: () => (source) => source.pipe(map(stretchFrames)),
};

function withIndex(identifier: string | undefined, length: number): string | undefined {
  return identifier ? `${identifier}${length}` : undefined;
}
