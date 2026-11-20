import { isEqual, omit } from 'lodash';

import { DataTransformerID, type DataTransformerConfig, type MatcherConfig } from '@grafana/data';
import {
  type FieldReference,
  getFieldReferenceKey,
  type OrganizeFieldsTransformerOptions,
  renameReferencedKeys,
} from '@grafana/data/internal';

import { type ColumnContext } from './types';

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

function entryKeys({ excludeByName, indexByName, renameByName }: OrganizeFieldsTransformerOptions): Set<string> {
  return new Set([
    ...Object.keys(excludeByName ?? {}),
    ...Object.keys(indexByName ?? {}),
    ...Object.keys(renameByName ?? {}),
  ]);
}

const catalogByReference = new WeakMap<ColumnContext, Map<string, string>>();

function getCatalogByReference(context: ColumnContext): Map<string, string> {
  let catalog = catalogByReference.get(context);
  if (!catalog) {
    catalog = new Map(
      context.references.map((reference, index) => [getFieldReferenceKey(reference), context.catalog[index]])
    );
    catalogByReference.set(context, catalog);
  }
  return catalog;
}

const normalizedEntries = new WeakMap<
  ColumnContext,
  { transformations: readonly DataTransformerConfig[]; normalized: readonly DataTransformerConfig[] }
>();

export function normalizeColumnsEntry(
  transformations: readonly DataTransformerConfig[],
  context: ColumnContext
): readonly DataTransformerConfig[] {
  const cached = normalizedEntries.get(context);
  if (cached?.transformations === transformations) {
    return cached.normalized;
  }

  const entry = findColumnsEntry(transformations, context.frameFilter);
  let normalized = transformations;
  if (entry) {
    const catalog = getCatalogByReference(context);
    const options = renameReferencedKeys(
      entry.options,
      (reference) => catalog.get(getFieldReferenceKey(reference)),
      context.catalog
    );
    if (options !== entry.options) {
      normalized = transformations.map((config, index) => (index === entry.index ? { ...config, options } : config));
    }
  }
  normalizedEntries.set(context, { transformations, normalized });
  return normalized;
}

export function withColumnReferences(
  transformations: readonly DataTransformerConfig[],
  context: ColumnContext
): DataTransformerConfig[] {
  const entry = findColumnsEntry(transformations, context.frameFilter);
  if (!entry) {
    return [...transformations];
  }

  const catalogReferences = new Map(context.catalog.map((name, index) => [name, context.references[index]]));
  const previous = new Map(Object.entries(entry.options.referenceByName ?? {}));
  const references: Array<[string, FieldReference]> = [];
  for (const key of entryKeys(entry.options)) {
    const reference = catalogReferences.get(key) ?? previous.get(key);
    if (reference) {
      references.push([key, reference]);
    }
  }

  const options = omit(entry.options, 'referenceByName');
  const next = references.length > 0 ? { ...options, referenceByName: Object.fromEntries(references) } : options;
  return transformations.map((config, index) => (index === entry.index ? { ...config, options: next } : config));
}
