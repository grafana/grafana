import { ActionModel, LinkModel } from '@grafana/data';

import { MenuItemProps } from '../components/Menu/MenuItem';

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

export const actionModelToContextMenuItems: (actions: ActionModel[]) => MenuItemProps[] = (actions) => {
  return actions.map((action) => {
    return {
      label: action.title,
      ariaLabel: action.title,
      icon: 'record-audio',
      onClick: action.onClick,
    };
  });
};
