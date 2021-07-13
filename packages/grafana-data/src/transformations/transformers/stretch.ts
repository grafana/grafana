import { map } from 'rxjs/operators';
import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { DataFrame, FieldType } from '../../types/dataFrame';

export type StretchFramesTransformerOptions = {};

export const stretchFramesTransformer: DataTransformerInfo<StretchFramesTransformerOptions> = {
  id: DataTransformerID.stretchFrames,
  name: 'Stretch',
  description: 'Stretch a set of data frames from wide to long',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
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
      })
    ),
};

function withIndex(identifier: string | undefined, length: number): string | undefined {
  return identifier ? `${identifier}${length}` : undefined;
}
