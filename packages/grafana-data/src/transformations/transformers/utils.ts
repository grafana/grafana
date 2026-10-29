import { type DataFrame } from '../../types/dataFrame';
import { SpecialValue } from '../../types/transformations';

/**
 * Retrieve the maximum number of fields in a series of a dataframe.
 */
export function findMaxFields(data: DataFrame[]) {
  let maxFields = 0;

  // Group to nested table needs at least two fields
  // a field to group on and to show in the nested table
  for (const frame of data) {
    if (frame.fields.length > maxFields) {
      maxFields = frame.fields.length;
    }
  }

  return maxFields;
}

export function getSpecialValue(specialValue: SpecialValue) {
  switch (specialValue) {
    case SpecialValue.False:
      return false;
    case SpecialValue.True:
      return true;
    case SpecialValue.Null:
      return null;
    case SpecialValue.Zero:
      return 0;
    case SpecialValue.Empty:
    default:
      return '';
  }
}

export const getTransformationDynamicRefId = (transformationId: string, data: DataFrame[]) => {
  return `${transformationId}-${data.map((frame) => frame.refId).join('-')}`;
};

/**
 * Names the frame a transformation passes through untouched, so a downstream byRefId filter keeps
 * matching when the input shrinks to the point the transformation becomes a no-op.
 *
 * Only single-frame output is renamed: naming every frame of a multi-frame passthrough would make
 * one filter match all of them. Copies rather than mutates, since the frame is the shared query result.
 */
export const applyStaticRefId = (frames: DataFrame[], refId?: string): DataFrame[] => {
  if (!refId || frames.length !== 1 || frames[0].refId === refId) {
    return frames;
  }
  return [{ ...frames[0], refId }];
};
