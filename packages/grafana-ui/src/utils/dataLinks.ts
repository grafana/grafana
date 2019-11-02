import { ContextMenuItem } from '../components/ContextMenu/ContextMenu';
import { LinkModelSupplier } from '@grafana/data';

export const DataLinkBuiltInVars = {
  keepTime: '__url_time_range',
  timeRangeFrom: '__from',
  timeRangeTo: '__to',
  includeVars: '__all_variables',
  seriesName: '__series.name',
  fieldName: '__field.name',
  valueTime: '__value.time',
  valueNumeric: '__value.numeric',
  valueText: '__value.text',
  valueRaw: '__value.raw',
  // name of the calculation represented by the value
  valueCalc: '__value.calc',
};

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
