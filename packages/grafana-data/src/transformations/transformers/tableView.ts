import { type DataFrame, FieldType } from '../../types/dataFrame';

import { filterByValueTransformer, type FilterByValueConfig } from './filterByValue';

export { getFrameIdentity as tableFrameKey, getRowIdentity as tableParentKey } from '../frameIdentity';

/** The caller has already selected the frame and parent represented by these rows. */
export function transformTableFrame(
  frame: DataFrame,
  filters: readonly FilterByValueConfig[],
  parentIndex?: number
): DataFrame {
  return filters.reduce((output, config) => {
    if (config.disabled || config.options.target?.parentIndex !== parentIndex) {
      return output;
    }
    return filterByValueTransformer.transformer(
      { ...config.options, target: undefined },
      { interpolate: (s) => s }
    )([output])[0];
  }, frame);
}

/** Project the original row indices through the same filtering implementation used by the host. */
export function tableViewIndices(
  frame: DataFrame,
  filters: readonly FilterByValueConfig[],
  parentIndex?: number
): number[] {
  let name = '__table_view_index';
  while (frame.fields.some((field) => field.name === name)) {
    name += '_';
  }
  const indexField = {
    name,
    type: FieldType.number,
    config: {},
    values: Array.from({ length: frame.length }, (_, i) => i),
  };
  const result = transformTableFrame({ ...frame, fields: [...frame.fields, indexField] }, filters, parentIndex);
  return result.fields[result.fields.length - 1].values;
}
