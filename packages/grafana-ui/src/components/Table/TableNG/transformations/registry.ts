import { columnOrder } from './columnOrder';
import { columnVisibility } from './columnVisibility';
import { type TableTransformation } from './types';

export const columnTransformations = {
  columnVisibility,
  columnOrder,
} satisfies Record<string, TableTransformation>;
