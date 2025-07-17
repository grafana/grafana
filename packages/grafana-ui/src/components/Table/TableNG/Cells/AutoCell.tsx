import { formattedValueToString } from '@grafana/data';

import { AutoCellProps } from '../types';
import { maybeWrapWithLink } from '../utils';

export default function AutoCell({ value, field, rowIdx }: AutoCellProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);
  return maybeWrapWithLink(field, rowIdx, formattedValue);
}
