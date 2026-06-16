import { type DataFrame, FieldType } from '@grafana/data';

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

export function getAnnoRegionBoxStyle(plotWidth: number, right: number, left: number) {
  const clampedRight = Math.min(plotWidth, right);
  const clampedLeft = Math.max(0, left);
  const width = clampedRight - clampedLeft;

  // If the anno is too small to see/click, adjust the left offset and set a minWidth
  const isAnnoTooSmall = width < ANNOTATION_REGION_MIN_WIDTH;
  const widthOffset = (ANNOTATION_REGION_MIN_WIDTH - width) / 2;
  const adjustedLeft = isAnnoTooSmall ? clampedLeft - widthOffset : clampedLeft;
  // clamp again in case centering after setting new minWidth bumped the edge of the anno out of the plot
  const clampedLeftAgain = Math.max(0, adjustedLeft);

  return {
    left: clampedLeftAgain,
    width,
    minWidth: isAnnoTooSmall ? ANNOTATION_REGION_MIN_WIDTH : undefined,
  };
}

export function shouldRenderAnnotationLine(width: number | undefined, multiLane: boolean | undefined) {
  if (width !== undefined) {
    return width > 0;
  }
  return !multiLane;
}

export function shouldRenderAnnotationRegion(opacity: number | undefined, multiLane: boolean | undefined) {
  if (opacity !== undefined) {
    return opacity > 0;
  }
  return !multiLane;
}
