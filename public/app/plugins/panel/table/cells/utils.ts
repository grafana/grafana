import { SelectableValue } from '@grafana/data';
import { CellMinMaxMode } from '@grafana/schema';

export const minMaxModes: SelectableValue[] = [
  { value: CellMinMaxMode.Local, label: 'Per field' },
  { value: CellMinMaxMode.Global, label: 'All fields' },
];
