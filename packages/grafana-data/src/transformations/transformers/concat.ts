import { map } from 'rxjs/operators';

import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { DataFrame, Field, TIME_SERIES_VALUE_FIELD_NAME } from '../../types/dataFrame';
import { ArrayVector } from '../../vector';

export enum ConcatenateFrameNameMode {
  /**
   * Ignore the source frame name when moving to the destination
   */
  Drop = 'drop',

  /**
   * Copy the source frame name to the destination field.  The final field will contain
   * both the frame and field name
   */
  FieldName = 'field',

  /**
   * Copy the source frame name to a label on the field.  The label key is controlled
   * by frameNameLabel
   */
  Label = 'label',
}

export interface ConcatenateTransformerOptions {
  frameNameMode?: ConcatenateFrameNameMode;
  frameNameLabel?: string;
}

export const concatenateTransformer: DataTransformerInfo<ConcatenateTransformerOptions> = {
  id: DataTransformerID.concatenate,
  name: 'Concatenate fields',
  description:
    'Combine all fields into a single frame.  Values will be appended with undefined values if not the same length.',
  defaultOptions: {
    frameNameMode: ConcatenateFrameNameMode.FieldName,
    frameNameLabel: 'frame',
  },
  operator: options => source =>
    source.pipe(
      map(dataFrames => {
        if (!Array.isArray(dataFrames) || dataFrames.length < 2) {
          return dataFrames; // noop with single frame
        }
        return [concatenateFields(dataFrames, options)];
      })
    ),
};

/**
 * @internal only exported for tests
 */
export function concatenateFields(data: DataFrame[], opts: ConcatenateTransformerOptions): DataFrame {
  let sameLength = true;
  let maxLength = data[0].length;
  const frameNameLabel = opts.frameNameLabel ?? 'frame';
  let fields: Field[] = [];

  for (const frame of data) {
    if (maxLength !== frame.length) {
      sameLength = false;
      maxLength = Math.max(maxLength, frame.length);
    }

    for (const f of frame.fields) {
      const copy = { ...f };
      copy.state = undefined;
      if (frame.name) {
        if (opts.frameNameMode === ConcatenateFrameNameMode.Drop) {
          // nothing -- skip the name
        } else if (opts.frameNameMode === ConcatenateFrameNameMode.Label) {
          copy.labels = { ...f.labels };
          copy.labels[frameNameLabel] = frame.name;
        } else if (!copy.name || copy.name === TIME_SERIES_VALUE_FIELD_NAME) {
          copy.name = frame.name;
        } else {
          copy.name = `${frame.name} · ${f.name}`;
        }
      }
      fields.push(copy);
    }
  }

  // Make sure all fields have the same length
  if (!sameLength) {
    fields = fields.map(f => {
      if (f.values.length === maxLength) {
        return f;
      }
      const values = f.values.toArray();
      values.length = maxLength;
      return {
        ...f,
        values: new ArrayVector(values),
      };
    });
  }

  return {
    fields,
    length: maxLength,
  };
}
