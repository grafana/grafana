import { type Field } from '@grafana/data';

import { type TableRow } from '../types';

export type Range = { min?: number; max?: number; includeMissing: boolean };

export interface RangeFilterProps {
  field: Field;
  rows: TableRow[];
  range?: Range;
  timeZone?: string;
  onApply: (range: Range) => void;
  onClear: () => void;
  onCancel: () => void;
}
