import { LinkModel, locationUtil } from '@grafana/data';

import { MenuItemProps } from '../components/Menu/MenuItem';
import { IconName } from '../types';

/**
 * Delays creating links until we need to open the ContextMenu
 */
export const linkModelToContextMenuItems: (links: () => LinkModel[]) => MenuItemProps[] = (links) => {
  return links().map((link) => {
    return {
      label: link.title,
      ariaLabel: link.title,
      // TODO: rename to href
      url: locationUtil.stripBaseFromUrl(link.href), // LOGZ.IO GRAFANA CHANGE :: DEV-23541 Use the url without the grafana-app part
      target: link.target,
      icon: `${link.target === '_self' ? 'link' : 'external-link-alt'}` as IconName,
      onClick: link.onClick,
    };
  });
};
