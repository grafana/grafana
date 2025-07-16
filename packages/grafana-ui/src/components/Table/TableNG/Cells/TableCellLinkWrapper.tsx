import { useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { TableCellLinkWraperProps } from '../types';
import { getCellLinks, getCellOptions, withDataLinksActionsTooltip } from '../utils';

/**
 * for cells which can either have a single link out to their individual datalink, or can pop
 * open a context menu with multiple links and actions, this component will wrap the cell's contents
 * in the expected markup so that TableNG will correctly handle click events.
 */
export function TableCellLinkWraper({ field, rowIdx, children }: TableCellLinkWraperProps) {
  const linksCount = field.config.links?.length ?? 0;
  const actionsCount = field.config.actions?.length ?? 0;
  const shouldShowSingleLink = linksCount === 1 && actionsCount === 0;
  const shouldShowMultiLink = withDataLinksActionsTooltip(field, getCellOptions(field).type);
  const singleLink = useMemo(() => {
    if (shouldShowSingleLink) {
      return (getCellLinks(field, rowIdx) ?? [])[0];
    }
    return null;
  }, [field, shouldShowSingleLink, rowIdx]);

  if (shouldShowMultiLink) {
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    return <a aria-controls="table-data-links-actions-tooltip">{children}</a>;
  }

  if (singleLink) {
    return (
      <a
        href={singleLink.href}
        onClick={singleLink.onClick}
        target={singleLink.target}
        title={singleLink.title}
        data-testid={selectors.components.DataLinksContextMenu.singleLink}
      >
        {children}
      </a>
    );
  }

  return children;
}
