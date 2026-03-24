import { DataFrame, FieldType } from '@grafana/data';

import { AnnotationVals } from './annotations2-cluster/types';

// Annotation points/regions are 5px with 1px of padding
export const ANNOTATION_LANE_SIZE = 7;
export const ANNOTATION_REGION_MIN_WIDTH = 5;

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

export function getAnnoRegionStyle(
  plotWidth: number,
  right: number,
  left: number,
  vals: AnnotationVals,
  i: number,
  color: string,
  top: number | undefined
) {
  const clampedRight = Math.min(plotWidth, right);
  const width = clampedRight - left;
  const clusteredAnnoTooSmall = vals.clusterIdx?.[i] != null && width <= ANNOTATION_REGION_MIN_WIDTH;
  // If the clustered anno is too small to see/click, adjust the left offset and set a minWidth
  const adjustedLeft = clusteredAnnoTooSmall ? left - ANNOTATION_REGION_MIN_WIDTH / 2 : left;
  const clampedLeft = Math.max(0, adjustedLeft);

  return {
    left: clampedLeft,
    background: color,
    width,
    top,
    minWidth: clusteredAnnoTooSmall ? ANNOTATION_REGION_MIN_WIDTH : undefined,
  };
}
