import { ContextMenuItem } from '../components/ContextMenu/ContextMenu';
import { LinkModel } from '@grafana/data';

export const linkModelToContextMenuItems: (links: LinkModel[]) => ContextMenuItem[] = links => {
  return links.map(link => {
    return {
      label: link.title,
      // TODO: rename to href
      url: link.href,
      target: link.target,
    };
  });
};
