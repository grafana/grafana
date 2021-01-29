import { LinkModel } from '@grafana/data';
import { MenuItem } from '../components/Menu/Menu';
import { IconName } from '../types';

/**
 * Delays creating links until we need to open the ContextMenu
 */
export const linkModelToContextMenuItems: (links: () => LinkModel[]) => MenuItem[] = (links) => {
  return links().map((link) => {
    return {
      label: link.title,
      // TODO: rename to href
      url: link.href,
      target: link.target,
      icon: `${link.target === '_self' ? 'link' : 'external-link-alt'}` as IconName,
      onClick: link.onClick,
    };
  });
};
