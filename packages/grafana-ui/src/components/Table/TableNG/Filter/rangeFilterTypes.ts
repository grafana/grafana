import { type Field } from '@grafana/data';

import { type RangeSelection } from '../transformations/rangeFilter';
import { type TableRow } from '../types';

export interface RangeFilterProps {
  field: Field;
  rows: TableRow[];
  range?: RangeSelection;
  timeZone?: string;
  onApply: (range: RangeSelection) => void;
  onClear: () => void;
  onCancel: () => void;
}
