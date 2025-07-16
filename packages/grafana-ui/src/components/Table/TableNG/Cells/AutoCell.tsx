import { formattedValueToString } from '@grafana/data';

import { renderSingleLink } from '../../DataLinksActionsTooltip';
import { useSingleLink } from '../hooks';
import { AutoCellProps } from '../types';

export default function AutoCell({ value, field, rowIdx }: AutoCellProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);
  const link = useSingleLink(field, rowIdx);

  if (link != null) {
    return renderSingleLink(link, formattedValue);
  }

  if ((field.config.links?.length ?? 0 > 1) || (field.config.actions?.length ?? 0 > 0)) {
    return <a href="#;">{formattedValue}</a>;
  }

  return formattedValue;
}
