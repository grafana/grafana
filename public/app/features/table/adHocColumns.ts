import { isEqual } from 'lodash';

import {
  DataTransformerID,
  FrameMatcherID,
  type DataFrame,
  type DataTransformerConfig,
  type MatcherConfig,
} from '@grafana/data';
import { type OrganizeFieldsTransformerOptions } from '@grafana/data/internal';

export interface AdHocColumnState {
  hiddenColumns: ReadonlySet<string>;
}

const NO_COLUMN_STATE: AdHocColumnState = { hiddenColumns: new Set() };

const EMPTY_OPTIONS: OrganizeFieldsTransformerOptions = { indexByName: {}, excludeByName: {}, renameByName: {} };

interface ColumnsEntry {
  index: number;
  options: OrganizeFieldsTransformerOptions;
}

/**
 * Finds the organize-fields transformation owned by the table column controls for one frame scope.
 * Other organize transformations and entries for other frames are left alone.
 */
export function findColumnsEntry(
  transformations: readonly DataTransformerConfig[],
  frameFilter?: MatcherConfig
): ColumnsEntry | undefined {
  const index = transformations.findIndex(
    (config) => config.id === DataTransformerID.organize && isEqual(config.filter, frameFilter)
  );

  return index === -1 ? undefined : { index, options: transformations[index].options ?? {} };
}

/**
 * Converts the matching organize-fields transformation into the controlled state expected by TableNG.
 * The catalog must contain display names from the untransformed source frame so hidden columns remain available.
 */
export function decodeAdHocColumns(
  transformations: readonly DataTransformerConfig[],
  _catalog: string[],
  frameFilter?: MatcherConfig
): AdHocColumnState {
  const entry = findColumnsEntry(transformations, frameFilter);

  if (!entry) {
    return NO_COLUMN_STATE;
  }

  const { excludeByName = {} } = entry.options;

  return {
    hiddenColumns: new Set(Object.keys(excludeByName).filter((name) => excludeByName[name])),
  };
}

/**
 * Replaces the organize-fields entry for one frame scope while preserving every other ad-hoc transformation.
 * Removes the entry when none of its organize options has an effect.
 */
function writeColumnsEntry(
  transformations: readonly DataTransformerConfig[],
  next: OrganizeFieldsTransformerOptions,
  frameFilter?: MatcherConfig
): DataTransformerConfig[] {
  const entry = findColumnsEntry(transformations, frameFilter);
  const isEmpty =
    Object.keys(next.indexByName ?? {}).length === 0 &&
    Object.values(next.excludeByName ?? {}).every((hidden) => !hidden) &&
    Object.keys(next.renameByName ?? {}).length === 0;

  if (isEmpty) {
    return entry ? transformations.filter((_, index) => index !== entry.index) : [...transformations];
  }

  const config: DataTransformerConfig = {
    id: DataTransformerID.organize,
    options: next,
    ...(frameFilter ? { filter: frameFilter } : {}),
  };

  if (!entry) {
    return [...transformations, config];
  }

  return transformations.map((existing, index) => (index === entry.index ? config : existing));
}

/**
 * Stores the hidden TableNG columns in the matching organize-fields transformation.
 * Existing column order, renames, and transformations outside this frame scope are preserved.
 */
export function encodeHiddenColumns(
  transformations: readonly DataTransformerConfig[],
  hidden: ReadonlySet<string>,
  frameFilter?: MatcherConfig
): DataTransformerConfig[] {
  const excludeByName = Array.from(hidden).reduce<Record<string, boolean>>((acc, name) => {
    acc[name] = true;
    return acc;
  }, {});

  return writeColumnsEntry(
    transformations,
    { ...EMPTY_OPTIONS, ...findColumnsEntry(transformations, frameFilter)?.options, excludeByName },
    frameFilter
  );
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
