import { ReactNode } from 'react';

import { Field, formattedValueToString } from '@grafana/data';

import { renderSingleLink } from '../../DataLinksActionsTooltip';
import { AutoCellProps } from '../types';
import { getCellLinks } from '../utils';

export default function AutoCell({ value, field, rowIdx }: AutoCellProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);
  return maybeWrapWithLink(field, rowIdx, formattedValue);
}

function maybeWrapWithLink(field: Field, rowIdx: number, children: ReactNode): ReactNode {
  const linksCount = field.config.links?.length ?? 0;
  const actionsCount = field.config.actions?.length ?? 0;

  // as real, single link
  if (linksCount === 1 && actionsCount === 0) {
    let link = (getCellLinks(field, rowIdx) ?? [])[0];
    return renderSingleLink(link, children);
  }
  // as faux link that acts as hit-area for tooltip activation
  else if (linksCount + actionsCount > 0) {
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    return <a aria-haspopup="menu">{children}</a>;
  }

  // raw value
  return children;
}
