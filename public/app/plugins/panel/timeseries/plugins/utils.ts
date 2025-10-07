import { DataFrame, DataTopic } from '@grafana/data';

// Annotation points/regions are 5px with 1px of padding
export const ANNOTATION_LANE_SIZE = 7;

/**
 * Annotation frames:
 *   have a field named "time"
 *   have a frame meta dataTopic of "annotations"
 *   do not have a frame name of exemplar
 * @param dataFrames
 */
export function getAnnotationFrames(dataFrames: DataFrame[] = []) {
  return dataFrames.filter(
    (frame) =>
      frame.name !== 'exemplar' &&
      frame.meta?.dataTopic === DataTopic.Annotations &&
      frame.length > 0 &&
      frame.fields.some((f) => f.name === 'time')
  );
}
