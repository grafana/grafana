import { ContextMenuItem } from '../components/ContextMenu/ContextMenu';
import { LinkModelSupplier } from '@grafana/data';

/**
 * Delays creating links until we need to open the ContextMenu
 */
export const linkModelToContextMenuItems: (links: LinkModelSupplier<any>) => ContextMenuItem[] = links => {
  return links.getLinks().map(link => {
    return {
      label: link.title,
      // TODO: rename to href
      url: link.href,
      target: link.target,
      icon: `fa ${link.target === '_self' ? 'fa-link' : 'fa-external-link'}`,
      onClick: link.onClick,
    };
  });
};
