import { memo } from 'react';

import { Field, formattedValueToString } from '@grafana/data';

import { MaybeWrapWithLink } from './MaybeWrapWithLink';

export const CellRenderer = memo(({ value, field, rowIdx }: { value: unknown; field: Field; rowIdx: number }) => {
  if (value == null) {
    return null;
  }

  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      {field.display ? formattedValueToString(field.display(value)) : String(value)}
    </MaybeWrapWithLink>
  );
});

CellRenderer.displayName = 'CellRenderer';
