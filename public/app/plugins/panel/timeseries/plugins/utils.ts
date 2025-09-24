import { DataFrame } from '@grafana/data';

// Annotation points/regions are 5px with 1px of padding
export const ANNOTATION_LANE_SIZE = 7;

export function getAnnotationFrames(dataFrames: DataFrame[] = []) {
  return dataFrames.filter(
    (frame) => frame.name !== 'exemplar' && frame.length > 0 && frame.fields.some((f) => f.name === 'time')
  );
}
