import { columnVisibility } from './columnVisibility';
import { type TableTransformation } from './types';

export const columnTransformations = {
  columnVisibility,
} satisfies Record<string, TableTransformation>;
