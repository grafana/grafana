import { BootData } from '../../types/config';
import { DataFrame } from '../../types/dataFrame';
import { SpecialValue } from '../../types/transformations';

declare global {
  interface Window {
    grafanaBootData?: BootData;
  }
}
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
