import { isEqual } from 'lodash';
import { map } from 'rxjs/operators';

import { sortDataFrame } from '../../dataframe/processDataFrame';
import { getFieldDisplayName } from '../../field/fieldState';
import { FieldType, type DataFrame } from '../../types/dataFrame';
import { type DataTransformContext, type SynchronousDataTransformerInfo } from '../../types/transformations';
import { getFrameIdentity } from '../frameIdentity';

import { DataTransformerID } from './ids';

export interface SortByField {
  field: string;
  /** Label used by a transient table view when field overrides rename a column. */
  displayName?: string;
  fieldLabels?: Record<string, string>;
  desc?: boolean;
  index?: number;
}

export interface SortByTransformerOptions {
  // NOTE: this structure supports an array, however only the first entry is used
  // future versions may support multi-sort options
  sort: SortByField[];
  /** Internal table view: stable multi-sort with table comparison semantics. */
  table?: boolean;
  target?: { frameKey: string };
}

export const sortByTransformer: SynchronousDataTransformerInfo<SortByTransformerOptions> = {
  id: DataTransformerID.sortBy,
  name: 'Sort by',
  description: 'Sort fields in a frame.',
  defaultOptions: {
    fields: {},
  },

  /**
   * Return a modified copy of the series. If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options, ctx) => (source) => source.pipe(map(sortByTransformer.transformer(options, ctx))),
  transformer: (options, ctx) => (data) => {
    if (!Array.isArray(data) || data.length === 0 || !options?.sort?.length) {
      return data;
    }
    return data.map((frame, index) => {
      if (options.target && getFrameIdentity(data, index) !== options.target.frameKey) {
        return frame;
      }
      if (!options.table) {
        return sortDataFrames([frame], options.sort, ctx)[0];
      }
      const nested = {
        ...frame,
        fields: frame.fields.map((field) =>
          field.type !== FieldType.nestedFrames
            ? field
            : {
                ...field,
                values: field.values.map((children: DataFrame[] | undefined) =>
                  children?.map((child) => sortTableFrame(child, options.sort))
                ),
              }
        ),
      };
      return sortTableFrame(nested, options.sort);
    });
  },
};

function sortDataFrames(data: DataFrame[], sort: SortByField[], ctx: DataTransformContext): DataFrame[] {
  return data.map((frame) => {
    const s = attachFieldIndex(frame, sort, ctx);
    if (s.length && s[0].index != null) {
      return sortDataFrame(frame, s[0].index, s[0].desc);
    }
    return frame;
  });
}

function attachFieldIndex(frame: DataFrame, sort: SortByField[], ctx: DataTransformContext): SortByField[] {
  return sort.map((s) => {
    if (s.index != null) {
      // null or undefined
      return s;
    }

    return {
      ...s,
      index: frame.fields.findIndex((f) => s.field === getFieldDisplayName(f, frame)),
    };
  });
}

const tableCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function sortTableFrame(frame: DataFrame, sort: SortByField[]): DataFrame {
  const keys = sort.flatMap((key) => {
    const field =
      frame.fields[
        key.index ??
          frame.fields.findIndex((f) =>
            key.displayName != null
              ? key.field === f.name && isEqual(key.fieldLabels, f.labels)
              : key.field === getFieldDisplayName(f, frame)
          )
      ];
    return field ? [{ field, direction: key.desc ? -1 : 1 }] : [];
  });
  if (!keys.length) {
    return frame;
  }
  const indices = Array.from({ length: frame.length }, (_, i) => i);
  indices.sort((a, b) => {
    for (const { field, direction } of keys) {
      const av = field.values[a];
      const bv = field.values[b];
      let comparison: number;
      switch (field.type) {
        case FieldType.number:
        case FieldType.time:
        case FieldType.boolean:
          comparison = av === bv ? 0 : av == null ? -1 : bv == null ? 1 : Number(av) - Number(bv);
          break;
        case FieldType.frame:
          comparison = (av?.value ?? 0) - (bv?.value ?? 0);
          break;
        default:
          comparison = tableCollator.compare(String(av ?? ''), String(bv ?? ''));
      }
      if (comparison === 0 && field.type === FieldType.time && field.nanos) {
        comparison = field.nanos[a] - field.nanos[b];
      }
      if (comparison && !Number.isNaN(comparison)) {
        return direction * comparison;
      }
    }
    return a - b;
  });
  return {
    ...frame,
    fields: frame.fields.map((field) => ({
      ...field,
      values: indices.map((i) => field.values[i]),
      ...(field.nanos ? { nanos: indices.map((i) => field.nanos![i]) } : {}),
      state: undefined,
    })),
  };
}
