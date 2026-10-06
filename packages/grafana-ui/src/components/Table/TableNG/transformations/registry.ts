import { type FilterByValueConfig } from '@grafana/data/internal';

import { columnOrder } from './columnOrder';
import { columnVisibility } from './columnVisibility';
import { rangeFilter } from './rangeFilter';
import { valueFilter } from './valueFilter';

export const tableTransformations = {
  rangeFilter,
  valueFilter,
  columnOrder,
  columnVisibility,
};

export const filterTransformations = [tableTransformations.valueFilter, tableTransformations.rangeFilter];

export function editableTableFilter(config: FilterByValueConfig) {
  return filterTransformations.some((definition) => definition.isEditable(config));
}
