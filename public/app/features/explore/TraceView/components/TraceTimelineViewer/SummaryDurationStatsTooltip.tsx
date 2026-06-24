import * as React from 'react';

import { Tooltip } from '@grafana/ui';

import { type SummaryDurationStat } from '../utils/summary-span';

interface Props {
  stats: SummaryDurationStat[];
  children: React.ReactElement;
}

// Wraps the inline summary duration stats (rendered the same way on the row
// label and the span bar) with a tooltip that labels each value, since the
// bare `min | median | max` numbers are otherwise ambiguous.
export function SummaryDurationStatsTooltip({ stats, children }: Props) {
  return (
    <Tooltip
      placement="top"
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
