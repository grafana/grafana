import { DataFrame, FieldType } from '@grafana/data';

// Annotation points/regions are 5px with 1px of padding
export const ANNOTATION_LANE_SIZE = 7;

export function getXAnnotationFrames(dataFrames: DataFrame[] = []) {
  return dataFrames.filter(
    (frame) =>
      frame.name !== 'exemplar' &&
      frame.name !== 'xymark' &&
      frame.length > 0 &&
      frame.fields.some((f) => f.type === FieldType.time)
  );
}

export function getXYAnnotationFrames(dataFrames: DataFrame[] = []) {
  return dataFrames.filter((frame) => frame.name === 'xymark');
}
