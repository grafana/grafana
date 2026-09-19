import { type DataFrame, FieldType } from '../types/dataFrame';

/** Frame occurrence disambiguates query results sharing a refId and schema. */
export function getFrameIdentity(frames: readonly DataFrame[], index: number): string {
  const signature = (frame: DataFrame) =>
    JSON.stringify([frame.refId, frame.name, frame.fields.map((field) => [field.name, field.type, field.labels])]);
  const frame = frames[index];
  if (!frame) {
    return '';
  }
  const key = signature(frame);
  const occurrence = frames.slice(0, index).filter((f) => signature(f) === key).length;
  return `${key}:${occurrence}`;
}

export function getRowIdentity(frame: DataFrame, parentIndex: number): string {
  return JSON.stringify(
    frame.fields.filter((field) => field.type !== FieldType.nestedFrames).map((field) => field.values[parentIndex])
  );
}
