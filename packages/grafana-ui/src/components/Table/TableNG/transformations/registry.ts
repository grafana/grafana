import { type FilterByValueConfig } from '@grafana/data/internal';

import { columnOrder } from './columnOrder';
import { columnVisibility } from './columnVisibility';
import { rangeFilter } from './rangeFilter';
import { type TableTransformation } from './types';
import { valueFilter } from './valueFilter';

export const columnTransformations = {
  columnVisibility,
  columnOrder,
} satisfies Record<string, TableTransformation>;

export const filterTransformations = {
  valueFilter,
  rangeFilter,
};

export function editableTableFilter(config: FilterByValueConfig) {
  return Object.values(filterTransformations).some((definition) => definition.isEditable(config));
}
