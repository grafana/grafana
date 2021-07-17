import { DataFrame, Field, getFieldDisplayName } from '@grafana/data';

export function findField(frame: DataFrame, name?: string): Field | undefined {
  if (!name?.length) {
    return undefined;
  }

  for (const field of frame.fields) {
    if (name === field.name) {
      return field;
    }
    const disp = getFieldDisplayName(field, frame);
    if (name === disp) {
      return field;
    }
  }
  return undefined;
}
