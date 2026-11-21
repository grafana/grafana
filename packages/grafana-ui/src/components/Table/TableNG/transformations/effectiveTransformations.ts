import { isEmpty, isEqual, pickBy } from 'lodash';

import {
  type DataFrame,
  type DataTransformerConfig,
  DataTransformerID,
  FieldMatcherID,
  FieldType,
  getFieldMatcher,
  getFrameMatchers,
  LoadingState,
} from '@grafana/data';
import {
  createOrderFieldsComparer,
  type FilterByValueConfig,
  type FilterByValueFilter,
  type FilterByValueTransformerOptions,
  getRowIdentity,
  type OrganizeFieldsTransformerOptions,
} from '@grafana/data/internal';

import { getDisplayName, getVisibleFields } from '../utils';

import { withCachedDisplayNames } from './columnContext';
import { mergeColumnOrder } from './columnOrder';

interface SourceData {
  frames: DataFrame[];
  series: readonly DataFrame[];
  complete: boolean;
}

const TABLE_ORGANIZE_OPTIONS = new Set(['excludeByName', 'indexByName', 'renameByName', 'includeByName']);

export function getEffectiveTableTransformations(
  transformations: readonly DataTransformerConfig[],
  sourceSeries: readonly DataFrame[],
  dataState?: LoadingState
): DataTransformerConfig[] {
  const source =
    sourceSeries.length > 0
      ? {
          frames: withCachedDisplayNames(sourceSeries),
          series: sourceSeries,
          complete: dataState === LoadingState.Done,
        }
      : undefined;

  return transformations.flatMap((config) => getEffectiveConfig(config, source) ?? []);
}

function getEffectiveConfig(config: DataTransformerConfig, source?: SourceData): DataTransformerConfig | undefined {
  if (config.disabled) {
    return undefined;
  }

  if (config.id === DataTransformerID.organize) {
    return getEffectiveColumns(config, source);
  }

  if (isFilterByValue(config)) {
    return getEffectiveFilter(config, source);
  }

  return config;
}

function isFilterByValue(config: DataTransformerConfig): config is FilterByValueConfig {
  return config.id === DataTransformerID.filterByValue;
}

function getEffectiveColumns(config: DataTransformerConfig, source?: SourceData): DataTransformerConfig | undefined {
  const options: Partial<OrganizeFieldsTransformerOptions> = config.options ?? {};
  const excludeByName = options.excludeByName ?? {};
  const indexByName = options.indexByName ?? {};
  const hidden = Object.keys(excludeByName).filter((name) => excludeByName[name]);
  const tableEntry =
    Object.keys(options).every((key) => TABLE_ORGANIZE_OPTIONS.has(key)) &&
    isEmpty(options.renameByName) &&
    isEmpty(options.includeByName);

  if (!tableEntry) {
    return config;
  }

  if (hidden.length === 0 && isEmpty(indexByName)) {
    return undefined;
  }

  if (!source) {
    return config;
  }

  const targets = getTargetFrames(config, source.series);
  if (!targets || (targets.length === 0 && !source.complete)) {
    return config;
  }

  const frames = withCachedDisplayNames(targets);
  const excluded = getExcludedFields(hidden, frames);
  const removed = excluded.some(removesFrame);
  const catalogs = frames.map((frame) => getVisibleFields(frame.fields).map(getDisplayName));
  const managedByTable = frames.length === 1 && !removed;
  if (managedByTable && new Set(catalogs[0]).size !== catalogs[0].length) {
    return undefined;
  }

  const hiddenColumns = managedByTable
    ? hidden.filter((name) => catalogs[0].includes(name))
    : getEffectiveHidden(hidden, frames, excluded);
  const order = !removed
    ? getEffectiveOrder(indexByName, catalogs)
    : frames.length > 1 && !isEmpty(indexByName)
      ? indexByName
      : undefined;

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

  return isEqual(next, options) ? config : { ...config, options: next };
}

function getExcludedFields(names: string[], frames: DataFrame[]): boolean[][] {
  const matches = getFieldMatcher({ id: FieldMatcherID.byNames, options: { names } });
  return frames.map((frame) => frame.fields.map((field) => matches(field, frame, frames)));
}

function removesFrame(excluded: boolean[]): boolean {
  return excluded.length > 0 && excluded.every(Boolean);
}

function getEffectiveHidden(hidden: string[], frames: DataFrame[], excluded: boolean[][]): string[] {
  const visible = frames.map((frame) => new Set(getVisibleFields(frame.fields)));
  const layout = (fields: boolean[][]) =>
    fields.map((flags, index) =>
      removesFrame(flags) ? undefined : flags.filter((_, column) => visible[index].has(frames[index].fields[column]))
    );
  const names = new Set(
    visible.flatMap((fields) => [...fields].flatMap((field) => [field.name, getDisplayName(field)]))
  );
  const applied = hidden.filter((name) => names.has(name));
  if (applied.length === hidden.length) {
    return applied;
  }

  return isEqual(layout(getExcludedFields(applied, frames)), layout(excluded)) ? applied : hidden;
}

function getTargetFrames(config: DataTransformerConfig, frames: readonly DataFrame[]): DataFrame[] | undefined {
  if (!config.filter?.options) {
    return [...frames];
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
  const names = new Set(catalogs.flat());
  const known = pickBy(indexByName, (_, name) => names.has(name));
  if (isEmpty(known)) {
    return undefined;
  }

  if (catalogs.length === 1) {
    const order = mergeColumnOrder(catalogs[0], indexByName);
    return isEqual(order, catalogs[0]) ? undefined : Object.fromEntries(order.map((name, index) => [name, index]));
  }

  const compare = createOrderFieldsComparer(indexByName);
  return catalogs.every((catalog) => isEqual([...catalog].sort(compare), catalog)) ? undefined : known;
}

function getEffectiveFilter(config: FilterByValueConfig, source?: SourceData): DataTransformerConfig | undefined {
  const { filters, target, missingField } = config.options ?? {};
  if (!Array.isArray(filters) || filters.length === 0) {
    return undefined;
  }

  const scopes = source && !config.filter?.options ? getFilterScopes(target, source) : undefined;
  if (!scopes) {
    return config;
  }

  const applies =
    missingField === 'ignore'
      ? filters.some((filter) => scopes.some((frame) => hasFilterField(frame, filter)))
      : scopes.length > 0;

  return applies ? config : undefined;
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
  const parentKey = target?.parentKey;

  const scopes =
    parentIndex == null
      ? candidates
      : candidates.flatMap((frame) => {
          if (parentIndex >= frame.length || (parentKey != null && getRowIdentity(frame, parentIndex) !== parentKey)) {
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
