import { type DataFrame, FieldType } from '../types/dataFrame';

export function getRowIdentity(frame: DataFrame, parentIndex: number): string {
  return JSON.stringify(
    frame.fields.filter((field) => field.type !== FieldType.nestedFrames).map((field) => field.values[parentIndex])
  );
}
