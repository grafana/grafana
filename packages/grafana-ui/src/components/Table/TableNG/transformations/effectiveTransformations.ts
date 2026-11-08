import { isEmpty, isEqual, pickBy, uniq } from 'lodash';

import {
  type DataFrame,
  type DataTransformerConfig,
  DataTransformerID,
  FieldType,
  getFrameMatchers,
  LoadingState,
} from '@grafana/data';
import {
  type FilterByValueConfig,
  type FilterByValueFilter,
  type FilterByValueTransformerOptions,
  getRowIdentity,
  type OrganizeFieldsTransformerOptions,
} from '@grafana/data/internal';

import { getDisplayName, getVisibleFields } from '../utils';

import { withCachedDisplayNames } from './columnContext';
import { mergeColumnOrder } from './columnOrder';

export interface EffectiveTableTransformations {
  transformations: DataTransformerConfig[];
  hiddenColumns: string[];
  reordered: boolean;
  filteredFields: string[];
}

interface EffectiveConfig {
  config: DataTransformerConfig;
  hiddenColumns?: string[];
  reordered?: boolean;
  filteredFields?: string[];
}

interface SourceData {
  frames: DataFrame[];
  complete: boolean;
}

const TABLE_ORGANIZE_OPTIONS = new Set(['excludeByName', 'indexByName', 'renameByName', 'includeByName']);

export function getEffectiveTableTransformations(
  transformations: readonly DataTransformerConfig[],
  sourceSeries: readonly DataFrame[],
  dataState?: LoadingState
): EffectiveTableTransformations {
  const source =
    sourceSeries.length > 0
      ? { frames: withCachedDisplayNames(sourceSeries), complete: dataState === LoadingState.Done }
      : undefined;
  const effective = transformations.flatMap((config) => getEffectiveConfig(config, source) ?? []);

  return {
    transformations: effective.map(({ config }) => config),
    hiddenColumns: uniq(effective.flatMap(({ hiddenColumns = [] }) => hiddenColumns)),
    reordered: effective.some(({ reordered }) => reordered),
    filteredFields: uniq(effective.flatMap(({ filteredFields = [] }) => filteredFields)),
  };
}

function getEffectiveConfig(config: DataTransformerConfig, source?: SourceData): EffectiveConfig | undefined {
  if (config.disabled) {
    return undefined;
  }

  if (config.id === DataTransformerID.organize) {
    return getEffectiveColumns(config, source);
  }

  if (isFilterByValue(config)) {
    return getEffectiveFilter(config, source);
  }

  return { config };
}

function isFilterByValue(config: DataTransformerConfig): config is FilterByValueConfig {
  return config.id === DataTransformerID.filterByValue;
}

function getEffectiveColumns(config: DataTransformerConfig, source?: SourceData): EffectiveConfig | undefined {
  const options: Partial<OrganizeFieldsTransformerOptions> = config.options ?? {};
  const excludeByName = options.excludeByName ?? {};
  const indexByName = options.indexByName ?? {};
  const hidden = new Set(Object.keys(excludeByName).filter((name) => excludeByName[name]));
  const ordered = Object.keys(indexByName).length > 0;
  const unchecked = { config, hiddenColumns: [...hidden], reordered: ordered };
  const tableEntry =
    Object.keys(options).every((key) => TABLE_ORGANIZE_OPTIONS.has(key)) &&
    isEmpty(options.renameByName) &&
    isEmpty(options.includeByName);

  if (!tableEntry) {
    return unchecked;
  }

  if (hidden.size === 0 && !ordered) {
    return undefined;
  }

  if (!source) {
    return unchecked;
  }

  const targets = getTargetFrames(config, source.frames);
  if (!targets || (targets.length === 0 && !source.complete)) {
    return unchecked;
  }

  const catalogs = targets.map((frame) => getVisibleFields(frame.fields).map(getDisplayName));
  const hiddenColumns = uniq(catalogs.flat().filter((name) => hidden.has(name)));
  const order = getEffectiveOrder(indexByName, catalogs);

  if (hiddenColumns.length === 0 && !order) {
    return undefined;
  }

  const next = { ...options };
  const nextExcludeByName = Object.fromEntries(hiddenColumns.map((name) => [name, true]));
  if (!isEqual(nextExcludeByName, excludeByName)) {
    next.excludeByName = nextExcludeByName;
  }
  if (!isEqual(order ?? {}, indexByName)) {
    next.indexByName = order ?? {};
  }

  return {
    config: isEqual(next, options) ? config : { ...config, options: next },
    hiddenColumns,
    reordered: Boolean(order),
  };
}

function getTargetFrames(config: DataTransformerConfig, frames: DataFrame[]): DataFrame[] | undefined {
  if (!config.filter?.options) {
    return frames;
  }

  try {
    const matches = getFrameMatchers(config.filter);
    return frames.filter((frame) => matches(frame));
  } catch {
    return undefined;
  }
}

function getEffectiveOrder(
  indexByName: Record<string, number>,
  catalogs: string[][]
): Record<string, number> | undefined {
  if (Object.keys(indexByName).length === 0) {
    return undefined;
  }

  const names = new Set(catalogs.flat());
  const known = pickBy(indexByName, (_, name) => names.has(name));
  if (isEmpty(known)) {
    return undefined;
  }

  if (catalogs.some((catalog) => new Set(catalog).size !== catalog.length)) {
    return known;
  }

  const orders = catalogs.map((catalog) => mergeColumnOrder(catalog, indexByName));
  if (orders.every((order, index) => isEqual(order, catalogs[index]))) {
    return undefined;
  }

  if (orders.length === 1) {
    return Object.fromEntries(orders[0].map((name, index) => [name, index]));
  }

  return known;
}

function getEffectiveFilter(config: FilterByValueConfig, source?: SourceData): EffectiveConfig | undefined {
  const { filters, target, missingField } = config.options ?? {};
  if (!Array.isArray(filters) || filters.length === 0) {
    return undefined;
  }

  const scopes = source && !config.filter?.options ? getFilterScopes(target, source) : undefined;
  if (!scopes) {
    return { config, filteredFields: filters.map(({ fieldName }) => fieldName) };
  }

  const applied =
    missingField === 'ignore'
      ? filters.filter((filter) => scopes.some((frame) => hasFilterField(frame, filter)))
      : scopes.length > 0
        ? filters
        : [];

  return applied.length > 0 ? { config, filteredFields: applied.map(({ fieldName }) => fieldName) } : undefined;
}

function getFilterScopes(
  target: FilterByValueTransformerOptions['target'],
  { frames, complete }: SourceData
): DataFrame[] | undefined {
  const candidates = target
    ? frames.filter(
        (frame, index) =>
          index === (target.frameIndex ?? 0) && (target.refId === undefined || frame.refId === target.refId)
      )
    : frames;
  const parentIndex = target?.parentIndex;

  const scopes =
    parentIndex == null
      ? candidates
      : candidates.flatMap((frame) => {
          if (
            parentIndex >= frame.length ||
            (target?.parentKey != null && getRowIdentity(frame, parentIndex) !== target.parentKey)
          ) {
            return [];
          }

          return frame.fields.flatMap((field) => {
            const children: unknown = field.type === FieldType.nestedFrames ? field.values[parentIndex] : undefined;
            return Array.isArray(children) ? withCachedDisplayNames(children) : [];
          });
        });

  return scopes.length > 0 || complete ? scopes : undefined;
}

function hasFilterField(frame: DataFrame, { field: identity, fieldName }: FilterByValueFilter): boolean {
  return frame.fields.some((field) =>
    identity
      ? field.name === identity.name && isEqual(field.labels, identity.labels)
      : getDisplayName(field) === fieldName
  );
}
