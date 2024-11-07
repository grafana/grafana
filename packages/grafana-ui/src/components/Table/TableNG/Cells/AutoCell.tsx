import { formattedValueToString } from '@grafana/data';

import { CellNGProps } from '../types';

export default function AutoCell({ value, field, height, justifyContent }: CellNGProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);

  return <div style={{ display: 'flex', justifyContent, height: `${height}px` }}>{formattedValue}</div>;
}
