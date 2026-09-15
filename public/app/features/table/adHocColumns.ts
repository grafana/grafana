import { isEqual } from 'lodash';

import {
  DataTransformerID,
  FrameMatcherID,
  type DataFrame,
  type DataTransformerConfig,
  type MatcherConfig,
} from '@grafana/data';
import { createOrderFieldsComparer, type OrganizeFieldsTransformerOptions } from '@grafana/data/internal';

/**
 * Column order and visibility ride on one `organize` entry in the panel's ad-hoc transformation
 * stage. `organize` already does exactly this — `indexByName` for order, `excludeByName` for
 * visibility — and it is keyed on field display name, which is the identity the table uses for
 * columns anyway.
 *
 * Everything here is pure: the stage is read and written wholesale, so a caller decodes, applies the
 * user's action, and encodes back.
 */

/** The transformation the table owns in the stage. Anything else there is left alone. */
const COLUMNS_TRANSFORMER_ID = DataTransformerID.organize;

export interface AdHocColumnState {
  /** Display names in the order the table should show them, or undefined for "as the fields come". */
  columnOrder?: string[];
  hiddenColumns: ReadonlySet<string>;
}

const NO_COLUMN_STATE: AdHocColumnState = { columnOrder: undefined, hiddenColumns: new Set() };

/** `organize` requires all three maps, so a partial entry has to be filled in before it is written. */
const EMPTY_OPTIONS: OrganizeFieldsTransformerOptions = { indexByName: {}, excludeByName: {}, renameByName: {} };

interface ColumnsEntry {
  index: number;
  options: OrganizeFieldsTransformerOptions;
}

/**
 * The table's own entry in the stage for the given frame scope, if it has one.
 *
 * Scoped rather than "the one organize entry": a panel showing several frames keeps one entry per
 * frame, so hiding a column in the frame on screen leaves the others alone. The read has to be
 * scoped the same way the write is — the column state drives a table-level prop, so an entry
 * belonging to another frame would hide a column whose data is still there.
 */
export function findColumnsEntry(
  stage: readonly DataTransformerConfig[],
  frameFilter?: MatcherConfig
): ColumnsEntry | undefined {
  const index = stage.findIndex(
    (config) => config.id === COLUMNS_TRANSFORMER_ID && isEqual(config.filter, frameFilter)
  );

  return index === -1 ? undefined : { index, options: stage[index].options ?? {} };
}

/**
 * The column order and visibility the stage describes.
 *
 * `catalog` is every column the table could show, in the order the fields arrive; it comes from the
 * frames as they entered the stage, so it still contains the columns `excludeByName` has removed.
 */
export function decodeAdHocColumns(
  stage: readonly DataTransformerConfig[],
  catalog: string[],
  frameFilter?: MatcherConfig
): AdHocColumnState {
  const entry = findColumnsEntry(stage, frameFilter);

  if (!entry) {
    return NO_COLUMN_STATE;
  }

  const { indexByName = {}, excludeByName = {} } = entry.options;

  return {
    // Only an order the user actually set. Sorting by an empty index map is a no-op that would still
    // pin the table to a snapshot of the field order.
    columnOrder:
      Object.keys(indexByName).length > 0 ? [...catalog].sort(createOrderFieldsComparer(indexByName)) : undefined,
    // A `false` value is inert in the transformation, so it reads as visible here too.
    hiddenColumns: new Set(Object.keys(excludeByName).filter((name) => excludeByName[name])),
  };
}

/** The stage with the table's entry set to `next`, added, or removed once it says nothing. */
function writeColumnsEntry(
  stage: readonly DataTransformerConfig[],
  next: OrganizeFieldsTransformerOptions,
  frameFilter?: MatcherConfig
): DataTransformerConfig[] {
  const entry = findColumnsEntry(stage, frameFilter);
  const isEmpty =
    Object.keys(next.indexByName ?? {}).length === 0 &&
    Object.values(next.excludeByName ?? {}).every((hidden) => !hidden) &&
    Object.keys(next.renameByName ?? {}).length === 0;

  if (isEmpty) {
    // Leaving an empty organize behind would make "no ad-hoc view" indistinguishable from one the
    // user has reset, which everything downstream — reset controls, a future promote — keys off.
    return entry ? stage.filter((_, index) => index !== entry.index) : [...stage];
  }

  const config: DataTransformerConfig = {
    id: COLUMNS_TRANSFORMER_ID,
    options: next,
    ...(frameFilter ? { filter: frameFilter } : {}),
  };

  if (!entry) {
    return [...stage, config];
  }

  return stage.map((existing, index) => (index === entry.index ? config : existing));
}

/**
 * The table's entry with `indexByName` set from `order`.
 *
 * The map covers every column in the catalog, not just the ones that moved: `organize` sorts
 * unindexed names to `Number.MAX_SAFE_INTEGER`, so a partial map behaves surprisingly as soon as a
 * column appears in the middle of the list.
 */
export function encodeColumnOrder(
  stage: readonly DataTransformerConfig[],
  order: string[],
  frameFilter?: MatcherConfig
): DataTransformerConfig[] {
  const indexByName = order.reduce<Record<string, number>>((acc, name, index) => {
    acc[name] = index;
    return acc;
  }, {});

  // Spread the existing options so whatever is already there — hidden columns above all — survives.
  return writeColumnsEntry(
    stage,
    { ...EMPTY_OPTIONS, ...findColumnsEntry(stage, frameFilter)?.options, indexByName },
    frameFilter
  );
}

/** The table's entry with `excludeByName` set from `hidden`. */
export function encodeHiddenColumns(
  stage: readonly DataTransformerConfig[],
  hidden: ReadonlySet<string>,
  frameFilter?: MatcherConfig
): DataTransformerConfig[] {
  const excludeByName = Array.from(hidden).reduce<Record<string, boolean>>((acc, name) => {
    acc[name] = true;
    return acc;
  }, {});

  return writeColumnsEntry(
    stage,
    { ...EMPTY_OPTIONS, ...findColumnsEntry(stage, frameFilter)?.options, excludeByName },
    frameFilter
  );
}

/**
 * Scopes the table's entry to one frame, when the panel is showing one of several.
 *
 * Without it, hiding "Value" in the frame on screen also hides it in every other frame, which the
 * frame picker then presents as a column that has gone missing. Returns undefined when there is
 * nothing to scope to, in which case the entry applies to every frame as before.
 */
export function frameFilterFor(frames: DataFrame[], frameIndex: number): MatcherConfig | undefined {
  const refId = frames.length > 1 ? frames[frameIndex]?.refId : undefined;

  // A transformation's `filter` is resolved against the *frame* matcher registry, so this has to be
  // a FrameMatcherID. `FieldMatcherID.byFrameRefID` shares the idea and reads the part, but it
  // selects fields rather than frames and is not registered as a frame matcher at all — an
  // unresolvable filter is dropped, and the transformation then applies to every frame.
  return refId ? { id: FrameMatcherID.byRefId, options: refId } : undefined;
}
