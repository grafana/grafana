import { formattedValueToString } from '@grafana/data';

import { renderSingleLink } from '../../DataLinksActionsTooltip';
import { useSingleLink } from '../hooks';
import { AutoCellProps } from '../types';

export default function AutoCell({ value, field, rowIdx }: AutoCellProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);
  const link = useSingleLink(field, rowIdx);

  return link == null ? formattedValue : renderSingleLink(link, formattedValue);
}
