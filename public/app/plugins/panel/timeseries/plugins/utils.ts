import { DataFrame } from '@grafana/data';

export const ANNOTATION_LANE_SIZE = 5;

export function getAnnotationFrames(dataFrames: DataFrame[]) {
  return dataFrames.filter(
    (frame) => frame.name !== 'exemplar' && frame.length > 0 && frame.fields.some((f) => f.name === 'time')
  );
}
