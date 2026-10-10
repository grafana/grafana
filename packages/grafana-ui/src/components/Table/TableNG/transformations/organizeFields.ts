import { isEqual } from 'lodash';

import { DataTransformerID, type DataTransformerConfig, type MatcherConfig } from '@grafana/data';
import { type OrganizeFieldsTransformerOptions } from '@grafana/data/internal';

export const EMPTY_OPTIONS: OrganizeFieldsTransformerOptions = { indexByName: {}, excludeByName: {}, renameByName: {} };

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
 * Replaces the organize-fields entry for one frame scope while preserving every other ad-hoc transformation.
 * Removes the entry when none of its organize options has an effect.
 */
export function writeColumnsEntry(
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
