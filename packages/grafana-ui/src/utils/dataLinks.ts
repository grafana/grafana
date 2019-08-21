import { ContextMenuItem } from '../components/ContextMenu/ContextMenu';
import { LinkModel } from '@grafana/data';

export const DataLinkBuiltInVars = {
  keepTime: '__url_time_range',
  includeVars: '__all_variables',
  seriesName: '__series_name',
  valueTime: '__value_time',
};

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
