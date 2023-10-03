import { SelectableValue } from '@grafana/data';
import { CellMinMaxMode } from '@grafana/schema';

export const minMaxModes: SelectableValue[] = [
  { value: CellMinMaxMode.Local, label: 'Same field' },
  { value: CellMinMaxMode.Global, label: 'All fields' },
];
