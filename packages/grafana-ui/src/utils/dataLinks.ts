import type { LinkModel } from '@grafana/data/types';

import { type MenuItemProps } from '../components/Menu/MenuItem';

/**
 * Delays creating links until we need to open the ContextMenu
 */
export const linkModelToContextMenuItems: (links: () => LinkModel[]) => MenuItemProps[] = (links) => {
  return links().map((link) => {
    return {
      label: link.title,
      ariaLabel: link.title,
      // TODO: rename to href
      url: link.href,
      target: link.target,
      icon: `${link.target === '_blank' ? 'external-link-alt' : 'link'}`,
      onClick: link.onClick,
    };
  });
};
