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

function copyWithDisplayNames(frame: DataFrame): DataFrame {
  const copy = {
    ...frame,
    fields: frame.fields.map((field) => ({ ...field, state: field.state ? { ...field.state } : undefined })),
  };
  cacheFieldDisplayNames([copy]);
  return copy;
}

export function prepareColumnContext(
  sourceSeries: readonly DataFrame[],
  sourceIndex: number,
  displaySeries?: readonly DataFrame[]
): ColumnContext | undefined {
  // Hidden columns must remain in the catalog. Cache names on a copy.
  const frame = copyWithDisplayNames(sourceSeries[sourceIndex]);
  const displayFrame = displaySeries ? displaySeries[sourceIndex] : frame;
  if (displayFrame?.fields.length !== frame.fields.length) {
    return;
  }

  const visibleFields = new Set(getVisibleFields(frame.fields));
  const visibleIndexes = frame.fields.flatMap((field, index) => (visibleFields.has(field) ? [index] : []));
  const catalog = visibleIndexes.map((index) => getDisplayName(frame.fields[index]));
  const displayNames = visibleIndexes.map((index) => getDisplayName(displayFrame.fields[index]));

  // Display names identify columns; duplicates cannot be managed independently.
  if (new Set(catalog).size !== catalog.length || new Set(displayNames).size !== displayNames.length) {
    return;
  }
  return { catalog, displayNames, frameFilter: getFrameFilter(sourceSeries, sourceIndex) };
}

function translateNames(from: string[], to: string[], names: Iterable<string>): string[] {
  const translations = new Map(from.map((name, index) => [name, to[index]]));
  return Array.from(names).flatMap((name) => translations.get(name) ?? []);
}

export function toDisplayNames({ catalog, displayNames = catalog }: ColumnContext, names: Iterable<string>): string[] {
  return translateNames(catalog, displayNames, names);
}

export function toCatalogNames({ catalog, displayNames = catalog }: ColumnContext, names: Iterable<string>): string[] {
  return translateNames(displayNames, catalog, names);
}
