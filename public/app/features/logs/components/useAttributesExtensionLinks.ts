import { useMemo } from 'react';

import {
  type IconName,
  type LinkModel,
  type LogRowModel,
  PluginExtensionPoints,
  type PluginExtensionResourceAttributesContext,
  type TimeRange,
} from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';

interface LinkModelWithIcon extends LinkModel {
  icon?: IconName;
}

export const useAttributesExtensionLinks = (row: LogRowModel, timeRange: TimeRange) => {
  const context: PluginExtensionResourceAttributesContext = useMemo(() => {
    return {
      attributes: Object.fromEntries(Object.entries(row.labels).map(([key, value]) => [key, [value]])),
      timeRange: { from: timeRange.from.valueOf(), to: timeRange.to.valueOf() },
      datasource: {
        type: row.datasourceType ?? '',
        uid: row.datasourceUid ?? '',
      },
    };
  }, [row.labels, row.datasourceType, row.datasourceUid, timeRange]);

  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.LogsViewResourceAttributes,
    limitPerPlugin: 10,
    context,
  });

  return useMemo(() => {
    return links.reduce<Record<string, LinkModelWithIcon[]>>((acc, link) => {
      if (link.category) {
        const linkModel: LinkModelWithIcon = {
          href: link.path ?? '',
          target: '_blank',
          origin: undefined,
          title: link.title,
          onClick: link.onClick,
          icon: link.icon,
        };

        if (acc[link.category]) {
          acc[link.category].push(linkModel);
        } else {
          acc[link.category] = [linkModel];
        }
      }
      return acc;
    }, {});
  }, [links]);
};
