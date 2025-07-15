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

  const linksCount = field.config.links?.length ?? 0;
  const actionsCount = field.config.actions?.length ?? 0;
  const isMultilink = linksCount + actionsCount > 1;

  if (isMultilink) {
    return <span className="linklike">{formattedValue}</span>;
  }

  return formattedValue;
}
