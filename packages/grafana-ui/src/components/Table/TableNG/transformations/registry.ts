import { type FilterByValueConfig } from '@grafana/data/internal';

import { columnOrder } from './columnOrder';
import { columnVisibility } from './columnVisibility';
import { valueFilter } from './valueFilter';

export const tableTransformations = {
  valueFilter,
  columnOrder,
  columnVisibility,
};

export const columnTransformations = [tableTransformations.columnVisibility, tableTransformations.columnOrder];
export const filterTransformations = [tableTransformations.valueFilter];

export function editableTableFilter(config: FilterByValueConfig) {
  return filterTransformations.some((definition) => definition.isEditable(config));
}
