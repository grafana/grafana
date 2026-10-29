import { cacheFieldDisplayNames, FrameMatcherID, type DataFrame, type MatcherConfig } from '@grafana/data';

import { getDisplayName, getVisibleFields } from '../utils';

import { type ColumnContext } from './types';

/** Matches an output frame to its source without assuming transformations preserve frame order or count. */
export function getSourceFrameIndex(
  frames: readonly DataFrame[],
  frameIndex: number,
  sourceSeries: readonly DataFrame[]
): number {
  const frame = frames[frameIndex];
  if (!frame) {
    return -1;
  }

  if (frames.length === 1 && sourceSeries.length === 1 && frame.refId === sourceSeries[0].refId) {
    return 0;
  }

  // A shared or missing refId cannot identify which source frame the user selected.
  const refId = frame.refId;
  if (
    !refId ||
    frames.filter((frame) => frame.refId === refId).length !== 1 ||
    sourceSeries.filter((frame) => frame.refId === refId).length > 1
  ) {
    return -1;
  }

  return sourceSeries.findIndex((frame) => frame.refId === refId);
}

/**
 * Keeps the selected query's scope stable when other queries appear or disappear.
 * Returns no filter when the selected frame has no refId.
 */
export function getFrameFilter(frames: readonly DataFrame[], frameIndex: number): MatcherConfig | undefined {
  const refId = frames[frameIndex]?.refId;

  // An unresolvable frame matcher is dropped, which would apply the transform to every frame.
  if (!refId) {
    return;
  }

  return { id: FrameMatcherID.byRefId, options: refId };
}

export function prepareColumnContext(
  sourceSeries: readonly DataFrame[],
  sourceIndex: number
): ColumnContext | undefined {
  // Hidden columns must remain in the catalog. Cache names on copies, across the full source series.
  const source = sourceSeries.map((frame) => ({
    ...frame,
    fields: frame.fields.map((field) => ({ ...field, state: field.state ? { ...field.state } : undefined })),
  }));
  cacheFieldDisplayNames(source);
  const frame = source[sourceIndex];
  const catalog = getVisibleFields(frame.fields).map(getDisplayName);

  // Display names identify columns; duplicates cannot be managed independently.
  if (new Set(catalog).size !== catalog.length) {
    return;
  }
  return { catalog, frameFilter: getFrameFilter(sourceSeries, sourceIndex) };
}
