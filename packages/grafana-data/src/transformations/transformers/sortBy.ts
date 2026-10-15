import { isEqual } from 'lodash';
import { map } from 'rxjs/operators';

import { sortDataFrameByFields } from '../../dataframe/processDataFrame';
import { getFieldDisplayName } from '../../field/fieldState';
import { FieldType, type DataFrame } from '../../types/dataFrame';
import { type DataTransformContext, type SynchronousDataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

export interface SortByField {
  field: string;
  displayName?: string;
  fieldLabels?: Record<string, string>;
  desc?: boolean;
  index?: number;
}

export interface SortByTransformerOptions {
  // Earlier entries take priority; later ones only break ties.
  sort: SortByField[];
  table?: boolean;
  target?: { frameIndex: number; refId?: string; frameKey?: string };
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
      if (
        options.target &&
        (index !== options.target.frameIndex ||
          (options.target.refId !== undefined && frame.refId !== options.target.refId))
      ) {
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
    const sorts = attachFieldIndex(frame, sort, ctx).map(({ index = -1, desc }) => ({ index, desc }));
    return sortDataFrameByFields(frame, sorts);
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
          frame.fields.findIndex((candidate) =>
            key.displayName != null
              ? key.field === candidate.name && isEqual(key.fieldLabels, candidate.labels)
              : key.field === getFieldDisplayName(candidate, frame)
          )
      ];
    return field ? [{ field, direction: key.desc ? -1 : 1 }] : [];
  });
  if (!keys.length) {
    return frame;
  }
  const indices = Array.from({ length: frame.length }, (_, index) => index);
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
      values: indices.map((index) => field.values[index]),
      ...(field.nanos ? { nanos: indices.map((index) => field.nanos![index]) } : {}),
      state: undefined,
    })),
  };
}
