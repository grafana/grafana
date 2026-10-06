import { cacheFieldDisplayNames, FieldType, FrameMatcherID, type DataFrame, type MatcherConfig } from '@grafana/data';

import { getDisplayName, getVisibleFields } from '../utils';

import { type ColumnContext } from './types';

/** Matches an output frame to its source without assuming transformations preserve frame order or count. */
export function getSourceFrameIndex(
  frames: readonly DataFrame[],
  frameIndex: number,
  sourceSeries: readonly DataFrame[]
): number | undefined {
  const frame = frames[frameIndex];
  if (!frame) {
    return undefined;
  }

  if (frames.length === 1 && sourceSeries.length === 1 && frame.refId === sourceSeries[0].refId) {
    return 0;
  }

  // A shared or missing refId cannot identify which source frame the user selected.
  const refId = frame.refId;
  if (
    !refId ||
    frames.filter((frame) => frame.refId === refId).length !== 1 ||
    sourceSeries.filter((frame) => frame.refId === refId).length !== 1
  ) {
    return undefined;
  }

  return sourceSeries.findIndex((frame) => frame.refId === refId);
}

/**
 * Scopes a column transformation to the selected query when a table contains multiple frames.
 * Returns no filter for a single frame, or when the selected frame has no refId that can be matched safely.
 */
export function frameFilterFor(frames: readonly DataFrame[], frameIndex: number): MatcherConfig | undefined {
  const refId = frames.length > 1 ? frames[frameIndex]?.refId : undefined;

  // An unresolvable frame matcher is dropped, which would apply the transform to every frame.
  return refId ? { id: FrameMatcherID.byRefId, options: refId } : undefined;
}

export function supportsColumnManagement(frame: DataFrame | undefined): boolean {
  return Boolean(frame && !frame.fields.some((field) => field.type === FieldType.nestedFrames));
}

export function resolveColumnSourceIndex(
  frames: readonly DataFrame[],
  frameIndex: number,
  sourceSeries: readonly DataFrame[] | undefined
): number | undefined {
  if (!sourceSeries || !supportsColumnManagement(frames[frameIndex])) {
    return undefined;
  }
  const sourceIndex = getSourceFrameIndex(frames, frameIndex, sourceSeries);
  if (sourceIndex === undefined || !supportsColumnManagement(sourceSeries[sourceIndex])) {
    return undefined;
  }
  return sourceIndex;
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
    return undefined;
  }
  return { catalog, frameFilter: frameFilterFor(sourceSeries, sourceIndex) };
}
