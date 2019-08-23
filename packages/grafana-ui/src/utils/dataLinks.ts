import { ContextMenuItem } from '../components/ContextMenu/ContextMenu';
import { LinkModelSupplier } from '@grafana/data';

export const DataLinkBuiltInVars = {
  keepTime: '__url_time_range',
  includeVars: '__all_variables',
  seriesName: '__series_name',
  valueTime: '__value_time',
};

/**
 * Delays creating links until we need to open the ContextMenu
 */
export const linkModelToContextMenuItems: (links: LinkModelSupplier) => ContextMenuItem[] = links => {
  return links.getLinks().map(link => {
    return {
      label: link.title,
      // TODO: rename to href
      url: link.href,
      target: link.target,
    };
  });
};
