import { isEqual } from 'lodash';
import { map } from 'rxjs/operators';

import { getFieldDisplayName } from '../../field/fieldState';
import { type DataFrame, type Field, FieldType } from '../../types/dataFrame';
import {
  type DataTransformerConfig,
  type SynchronousDataTransformerInfo,
  type MatcherConfig,
} from '../../types/transformations';
import { getFrameIdentity, getRowIdentity } from '../frameIdentity';
import { getValueMatcher } from '../matchers';

import { DataTransformerID } from './ids';

export enum FilterByValueType {
  exclude = 'exclude',
  include = 'include',
}

export enum FilterByValueMatch {
  all = 'all',
  any = 'any',
}

export interface FilterByValueFilter {
  fieldName: string;
  /** Resolve raw identity before display names, which can change with field overrides. */
  field?: { name: string; labels?: Record<string, string> };
  config: MatcherConfig;
}

export interface FilterByValueTransformerOptions {
  filters: FilterByValueFilter[];
  type: FilterByValueType;
  match: FilterByValueMatch;
  missingField?: 'ignore';
  target?: {
    frameKey: string;
    parentIndex?: number;
    parentKey?: string;
  };
}

export interface FilterByValueConfig extends DataTransformerConfig<FilterByValueTransformerOptions> {
  id: DataTransformerID.filterByValue;
}

export const filterByValueTransformer: SynchronousDataTransformerInfo<FilterByValueTransformerOptions> = {
  id: DataTransformerID.filterByValue,
  name: 'Filter data by values',
  description: 'select a subset of results based on values',
  defaultOptions: {
    filters: [],
    type: FilterByValueType.include,
    match: FilterByValueMatch.any,
  },
  operator: (options, ctx) => (source) => source.pipe(map(filterByValueTransformer.transformer(options, ctx))),
  transformer: (options) => (data) => {
    if (!Array.isArray(options.filters) || options.filters.length === 0) {
      return data;
    }
    return data.map((frame, index) => {
      const target = options.target;
      if (target && getFrameIdentity(data, index) !== target.frameKey) {
        return frame;
      }
      if (target?.parentIndex != null) {
        const parentIndex = target.parentIndex;
        if (
          parentIndex >= frame.length ||
          (target.parentKey != null && getRowIdentity(frame, parentIndex) !== target.parentKey)
        ) {
          return frame;
        }
        return {
          ...frame,
          fields: frame.fields.map((field) =>
            field.type !== FieldType.nestedFrames
              ? field
              : {
                  ...field,
                  values: field.values.map((children: DataFrame[] | undefined, index: number) =>
                    index === parentIndex ? children?.map((child) => filterFrame(child, options, children)) : children
                  ),
                }
          ),
        };
      }
      return filterFrame(frame, options, data);
    });
  },
};

function filterFrame(frame: DataFrame, options: FilterByValueTransformerOptions, data: DataFrame[]): DataFrame {
  const fieldIndexByName: Record<string, number> = {};
  frame.fields.forEach((field, index) => {
    fieldIndexByName[getFieldDisplayName(field, frame, data)] = index;
  });
  const matchers = options.filters.flatMap((filter) => {
    const identity = filter.field;
    const fieldIndex = identity
      ? frame.fields.findIndex((field) => field.name === identity.name && isEqual(field.labels, identity.labels))
      : (fieldIndexByName[filter.fieldName] ?? -1);
    if (fieldIndex < 0) {
      if (options.missingField === 'ignore') {
        return [];
      }
      console.warn(`[FilterByValue] Could not find index for field name: ${filter.fieldName}`);
      return [() => false];
    }
    const matcher = getValueMatcher(filter.config);
    return [(index: number) => matcher(index, frame.fields[fieldIndex], frame, data)];
  });
  // Ignoring a stale target must not turn an exclude filter into "exclude everything".
  if (!matchers.length && options.missingField === 'ignore') {
    return frame;
  }
  const matchAll = options.match === FilterByValueMatch.all;
  const include = options.type === FilterByValueType.include;
  const indices: number[] = [];
  for (let index = 0; index < frame.length; index++) {
    const matches = matchAll ? matchers.every((match) => match(index)) : matchers.some((match) => match(index));
    if (matches === include) {
      indices.push(index);
    }
  }
  const fields: Field[] = frame.fields.map((field) => ({
    ...field,
    values: indices.map((index) => field.values[index]),
    ...(field.nanos ? { nanos: indices.map((index) => field.nanos![index]) } : {}),
    // Overrides recalculate state against the transformed values.
    state: {},
  }));
  return { ...frame, fields, length: indices.length };
}
