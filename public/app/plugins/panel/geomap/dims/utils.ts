import { DataFrame, Field, getFieldDisplayName, ReducerID } from '@grafana/data';

export function findField(frame?: DataFrame, name?: string): Field | undefined {
  if (!frame || !name?.length) {
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

export function getLastNotNullFieldValue<T>(field: Field): T {
  const calcs = field.state?.calcs;
  if (calcs) {
    const v = calcs[ReducerID.lastNotNull];
    if (v != null) {
      return v as T;
    }
  }

  const data = field.values;
  let idx = data.length - 1;
  while (idx >= 0) {
    const v = data.get(idx--);
    if (v != null) {
      return v;
    }
  }
  return undefined as any;
}
