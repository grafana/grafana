import * as React from 'react';

import { Tooltip } from '@grafana/ui';

import { type SummaryDurationStat } from '../utils/summary-span';

type TooltipPlacement = React.ComponentProps<typeof Tooltip>['placement'];

/**
 * Where to anchor the bar-side stats tooltip. The bar label renders to the LEFT
 * of the bar (stats at its right end) when the bar is near the right edge, and
 * to the RIGHT (stats at its left end) otherwise. The label widens on hover to
 * show the full service::operation text, so a centered tooltip would drift onto
 * that extra text; anchoring to the end nearest the stats keeps it over them.
 */
export function getSummaryStatsTooltipPlacement(viewStart: number, viewEnd: number): TooltipPlacement {
  return viewStart > 1 - viewEnd ? 'top-end' : 'top-start';
}

interface Props {
  stats: SummaryDurationStat[];
  children: React.ReactElement;
  placement?: TooltipPlacement;
}

// Wraps the inline summary duration stats (rendered the same way on the row
// label and the span bar) with a tooltip that labels each value, since the
// bare `min | median | max` numbers are otherwise ambiguous.
export function SummaryDurationStatsTooltip({ stats, children, placement = 'top' }: Props) {
  return (
    <Tooltip
      placement={placement}
      content={
        <div>
          {stats.map((stat) => (
            <div key={stat.label}>
              {stat.label}: {stat.value}
            </div>
          ))}
        </div>
      }
    >
      {children}
    </Tooltip>
  );
}
