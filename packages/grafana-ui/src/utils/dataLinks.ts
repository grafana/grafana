import { LinkModel, locationUtil } from '@grafana/data';

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
      url: locationUtil.stripBaseFromUrl(link.href), // LOGZ.IO GRAFANA CHANGE :: DEV-23541 Use the url without the grafana-app part
      target: link.target,
      icon: `${link.target === '_blank' ? 'external-link-alt' : 'link'}`,
      onClick: link.onClick,
    };
  });
};

export const isCompactUrl = (url: string) => {
  const compactExploreUrlRegex = /\/explore\?.*&(left|right)=\[(.*\,){2,}(.*){1}\]/;
  return compactExploreUrlRegex.test(url);
};
