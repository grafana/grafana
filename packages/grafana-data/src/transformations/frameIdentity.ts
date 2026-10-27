import { type DataFrame, FieldType } from '../types/dataFrame';

export function getRowIdentity(frame: DataFrame, parentIndex: number): string {
  const values: unknown[] = [];
  for (const field of frame.fields) {
    if (field.type !== FieldType.nestedFrames) {
      values.push(field.values[parentIndex]);
    }
  }
  return JSON.stringify(values);
}
