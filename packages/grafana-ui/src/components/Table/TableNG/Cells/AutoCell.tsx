import { formattedValueToString } from '@grafana/data';

import { MaybeWrapWithLink } from '../MaybeWrapWithLink';
import { AutoCellProps } from '../types';

export default function AutoCell({ value, field, rowIdx }: AutoCellProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);
  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      {formattedValue}
    </MaybeWrapWithLink>
  );
}
