import { SelectableValue } from '@grafana/data';
import { CellMinMaxMode } from '@grafana/schema';

export const minMaxModes: SelectableValue[] = [
  { value: CellMinMaxMode.Field, label: 'By field' },
  { value: CellMinMaxMode.Row, label: 'By row' },
];
