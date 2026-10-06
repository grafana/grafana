import { columnOrder } from './columnOrder';
import { columnVisibility } from './columnVisibility';

export const tableTransformations = {
  columnOrder,
  columnVisibility,
};

export const columnTransformations = [tableTransformations.columnVisibility, tableTransformations.columnOrder];
