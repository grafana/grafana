/**
 * TODO: REMOVE THIS FILE - ARCHITECTURAL DEBT
 *
 * This file contains utility functions duplicated from other panel implementations
 * to enable the Histogram panel to be extracted as a separate package.
 *
 * This is a temporary solution. The proper fix is to move these utilities to a
 * shared location (e.g., @grafana/ui or @grafana/data) so all panels can import
 * them without cross-panel dependencies.
 *
 * DO NOT ADD MORE FUNCTIONS TO THIS FILE.
 */

import { Field, LinkModel } from '@grafana/data';
import { TooltipDisplayMode } from '@grafana/schema';

/**
 * Duplicated from: public/app/plugins/panel/status-history/utils.ts
 * Original: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/status-history/utils.ts#L4-L23
 * TODO: Move to shared location and remove this duplication
 */
export const getDataLinks = (field: Field, rowIdx: number) => {
  const links: Array<LinkModel<Field>> = [];

  if ((field.config.links?.length ?? 0) > 0 && field.getLinks != null) {
    const v = field.values[rowIdx];
    const disp = field.display ? field.display(v) : { text: `${v}`, numeric: +v };

    const linkLookup = new Set<string>();

    field.getLinks({ calculatedValue: disp, valueRowIndex: rowIdx }).forEach((link) => {
      const key = `${link.title}/${link.href}`;
      if (!linkLookup.has(key)) {
        links.push(link);
        linkLookup.add(key);
      }
    });
  }

  return links;
};

export interface VizTooltipOptions {
  mode?: TooltipDisplayMode;
  maxHeight?: number;
}

/**
 * Duplicated from: public/app/plugins/panel/timeseries/utils.ts
 * Original: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/timeseries/utils.ts#L268-L270
 * TODO: Move to shared location and remove this duplication
 */
export const isTooltipScrollable = (tooltipOptions: VizTooltipOptions) => {
  return tooltipOptions.mode === TooltipDisplayMode.Multi && tooltipOptions.maxHeight != null;
};
