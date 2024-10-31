import { formattedValueToString } from '@grafana/data';

import { CellNGProps } from '../types';

export default function AutoCell({ value, field, justifyContent }: CellNGProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);

  return <div style={{ display: 'flex', justifyContent }}>{formattedValue}</div>;
}
