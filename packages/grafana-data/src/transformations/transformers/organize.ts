import { omit } from 'lodash';
import { map } from 'rxjs/operators';

import { cacheFieldDisplayNames, getFieldDisplayName } from '../../field/fieldState';
import { type DataFrame, type Field } from '../../types/dataFrame';
import {
  type DataTransformerInfo,
  type FieldMatcher,
  TransformationApplicabilityLevels,
} from '../../types/transformations';
import {
  createFieldIndex,
  createFieldReferenceIndex,
  type FieldReference,
  getFieldReferenceKey,
  isFieldReference,
} from '../frameIdentity';
import { getFieldMatcher } from '../matchers';

import { filterFieldsByNameTransformer, getMatcherConfig } from './filterByName';
import { DataTransformerID } from './ids';
import {
  createFieldsOrdererAuto,
  OrderByMode,
  orderFieldsTransformer,
  type OrderFieldsTransformerOptions,
} from './order';
import { renameFieldsTransformer, type RenameFieldsTransformerOptions } from './rename';

export interface OrganizeFieldsTransformerOptions
  extends OrderFieldsTransformerOptions,
    RenameFieldsTransformerOptions {
  excludeByName: Record<string, boolean>;
  includeByName?: Record<string, boolean>;
  referenceByName?: Record<string, FieldReference>;
}

export const organizeFieldsTransformer: DataTransformerInfo<OrganizeFieldsTransformerOptions> = {
  id: DataTransformerID.organize,
  name: 'Organize fields by name',
  description: 'Order, filter and rename fields based on configuration given by user',
  defaultOptions: {
    excludeByName: {},
    indexByName: {},
    renameByName: {},
    includeByName: {},
  },
  isApplicable: (data: DataFrame[]) => {
    return data.length > 1
      ? TransformationApplicabilityLevels.NotPossible
      : TransformationApplicabilityLevels.Applicable;
  },
  /**
   * Return a modified copy of the series. If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options, ctx) => (source) =>
    getValidReferences(options.referenceByName).length > 0
      ? source.pipe(map((data) => organizeByReference(data, options)))
      : source.pipe(
          filterFieldsByNameTransformer.operator(
            {
              include: options.includeByName ? { names: mapToExcludeArray(options.includeByName) } : undefined,
              exclude: { names: mapToExcludeArray(options.excludeByName) },
            },
            ctx
          ),
          orderFieldsTransformer.operator(options, ctx),
          renameFieldsTransformer.operator(options, ctx)
        ),
};

const mapToExcludeArray = (excludeByName: Record<string, boolean>): string[] => {
  if (!excludeByName) {
    return [];
  }

  return Object.keys(excludeByName).filter((name) => excludeByName[name]);
};

function getValidReferences(referenceByName: unknown): Array<[string, FieldReference]> {
  if (typeof referenceByName !== 'object' || referenceByName === null) {
    return [];
  }
  return Object.entries(referenceByName).filter((entry): entry is [string, FieldReference] =>
    isFieldReference(entry[1])
  );
}

export function renameReferencedKeys(
  options: OrganizeFieldsTransformerOptions,
  getName: (reference: FieldReference) => string | undefined,
  usedNames: Iterable<string>
): OrganizeFieldsTransformerOptions {
  if (options.referenceByName === undefined) {
    return options;
  }
  const references = getValidReferences(options.referenceByName);
  if (references.length === 0) {
    return omit(options, 'referenceByName');
  }

  const referenced = new Set(references.map(([key]) => key));
  const maps = [options.excludeByName, options.includeByName, options.indexByName, options.renameByName];
  const unreferenced = new Set(
    maps.flatMap((record) => Object.keys(record ?? {})).filter((key) => !referenced.has(key))
  );

  const claims = new Map<string, FieldReference | null>();
  const resolved: Array<[string, string]> = [];
  for (const [key, reference] of references) {
    const name = getName(reference);
    if (name === undefined || unreferenced.has(name)) {
      continue;
    }
    const claimed = claims.get(name);
    if (claimed === undefined) {
      claims.set(name, reference);
    } else if (claimed && getFieldReferenceKey(claimed) !== getFieldReferenceKey(reference)) {
      claims.set(name, null);
    }
    resolved.push([key, name]);
  }

  const names = new Map<string, string>();
  for (const [key, name] of resolved) {
    if (claims.get(name)) {
      names.set(key, name);
    }
  }
  const taken = new Set([...usedNames, ...unreferenced, ...claims.keys()]);
  const unclaimed = references.map(([key]) => key).filter((key) => !names.has(key));
  for (const key of unclaimed) {
    if (!taken.has(key)) {
      taken.add(key);
      names.set(key, key);
    }
  }
  for (const key of unclaimed) {
    if (!names.has(key)) {
      let name = key;
      for (let suffix = 1; taken.has(name); suffix++) {
        name = `${key} ${suffix}`;
      }
      taken.add(name);
      names.set(key, name);
    }
  }
  if (
    references.length === Object.keys(options.referenceByName).length &&
    Array.from(names).every(([key, name]) => key === name)
  ) {
    return options;
  }

  const rekey = <T>(record: Record<string, T> | undefined): Record<string, T> => {
    const rekeyed = new Map<string, T>();
    for (const [key, value] of Object.entries(record ?? {})) {
      const name = names.get(key) ?? key;
      if (!rekeyed.has(name)) {
        rekeyed.set(name, value);
      }
    }
    return Object.fromEntries(rekeyed);
  };

  return {
    ...options,
    excludeByName: rekey(options.excludeByName),
    ...(options.includeByName ? { includeByName: rekey(options.includeByName) } : {}),
    indexByName: rekey(options.indexByName),
    renameByName: rekey(options.renameByName),
    referenceByName: rekey(Object.fromEntries(references)),
  };
}

interface SplitEntries<T> {
  byName: Record<string, T>;
  byReference: Array<[FieldReference, T]>;
}

function splitByReference<T>(
  record: Record<string, T> | undefined,
  references: Map<string, FieldReference>
): SplitEntries<T> {
  const byName: Array<[string, T]> = [];
  const byReference: Array<[FieldReference, T]> = [];
  for (const [key, value] of Object.entries(record ?? {})) {
    const reference = references.get(key);
    if (reference === undefined) {
      byName.push([key, value]);
    } else {
      byReference.push([reference, value]);
    }
  }
  return { byName: Object.fromEntries(byName), byReference };
}

function hasDecisiveValue(entries: Array<[FieldReference, unknown]>): boolean {
  let find: ((reference: FieldReference) => number) | undefined;
  return entries.some(([reference, value], index) => {
    if (!value) {
      return false;
    }
    if (index === 0) {
      return true;
    }
    find ??= createFieldReferenceIndex(entries.map(([entry]) => entry));
    return find(reference) === index;
  });
}

function resolveFields<T>(
  entries: Array<[FieldReference, T]>,
  frame: DataFrame,
  find: () => (reference: FieldReference) => number
): Map<Field, T> {
  const resolved = new Map<Field, T>();
  for (const [reference, value] of entries) {
    const field = frame.fields[find()(reference)];
    if (field && !resolved.has(field)) {
      resolved.set(field, value);
    }
  }
  return resolved;
}

function getNamesMatcher(record: Record<string, boolean>): FieldMatcher | undefined {
  const config = getMatcherConfig({ names: mapToExcludeArray(record) });
  return config ? getFieldMatcher(config) : undefined;
}

function organizeByReference(data: DataFrame[], options: OrganizeFieldsTransformerOptions): DataFrame[] {
  const references = new Map(getValidReferences(options.referenceByName));
  const exclude = splitByReference(options.excludeByName, references);
  const include = splitByReference(options.includeByName, references);
  const index = splitByReference(options.indexByName, references);
  const rename = splitByReference(options.renameByName, references);
  const excludeMatcher = getNamesMatcher(exclude.byName);
  const includeMatcher = getNamesMatcher(include.byName);
  const including = Boolean(includeMatcher) || hasDecisiveValue(include.byReference);
  const filtering = including || Boolean(excludeMatcher) || hasDecisiveValue(exclude.byReference);
  const ordering = options.orderByMode !== OrderByMode.Auto;
  const renaming = rename.byReference.length > 0 || Object.keys(rename.byName).length > 0;

  const filtered: Array<{ frame: DataFrame; positions: Map<Field, number>; renames: Map<Field, string> }> = [];
  for (const frame of data) {
    let lookup: ((reference: FieldReference) => number) | undefined;
    const find = () => (lookup ??= createFieldIndex(frame));
    let fields = frame.fields;
    if (filtering) {
      const excluded = resolveFields(exclude.byReference, frame, find);
      const included = resolveFields(include.byReference, frame, find);
      fields = frame.fields.filter((field) => {
        const isExcluded = excluded.get(field) ?? excludeMatcher?.(field, frame, data) ?? false;
        const isIncluded = !including || (included.get(field) ?? includeMatcher?.(field, frame, data) ?? false);
        return !isExcluded && isIncluded;
      });
      if (fields.length === 0) {
        continue;
      }
    }
    filtered.push({
      frame: filtering ? { ...frame, fields } : frame,
      positions: ordering ? resolveFields(index.byReference, frame, find) : new Map(),
      renames: renaming ? resolveFields(rename.byReference, frame, find) : new Map(),
    });
  }

  const frames = filtered.map(({ frame }) => frame);
  cacheFieldDisplayNames(frames);
  const ordered = filtered.map(({ frame, positions, renames }) => {
    if (!ordering) {
      return { frame: { ...frame, fields: createFieldsOrdererAuto(options.orderBy ?? [])(frame.fields) }, renames };
    }
    const sortKeys = new Map(
      frame.fields.map((field) => {
        const position = positions.get(field) ?? index.byName[getFieldDisplayName(field, frame, frames)];
        return [field, Number.isInteger(position) ? position : Number.MAX_SAFE_INTEGER];
      })
    );
    return {
      frame: { ...frame, fields: [...frame.fields].sort((a, b) => sortKeys.get(a)! - sortKeys.get(b)!) },
      renames,
    };
  });

  if (!renaming) {
    return ordered.map(({ frame }) => frame);
  }
  return ordered.map(({ frame, renames }) => ({
    ...frame,
    fields: frame.fields.map((field) => {
      const renameTo = renames.get(field) ?? rename.byName[getFieldDisplayName(field, frame)];
      if (typeof renameTo !== 'string' || renameTo.length === 0) {
        return field;
      }
      return {
        ...field,
        config: { ...field.config, displayName: renameTo },
        state: { ...field.state, displayName: renameTo },
      };
    }),
  }));
}
