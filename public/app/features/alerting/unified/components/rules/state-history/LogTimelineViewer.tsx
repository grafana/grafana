import { memo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { DataFrame, InterpolateFunction, TimeRange } from '@grafana/data';
import { VisibilityMode } from '@grafana/schema';
import { LegendDisplayMode, useTheme2 } from '@grafana/ui';
import { TimelineChart } from 'app/core/components/TimelineChart/TimelineChart';
import { TimelineMode } from 'app/core/components/TimelineChart/utils';

interface LogTimelineViewerProps {
  frames: DataFrame[];
  timeRange: TimeRange;
}

// noop
const replaceVariables: InterpolateFunction = (v) => v;

export const LogTimelineViewer = memo(({ frames, timeRange }: LogTimelineViewerProps) => {
  const theme = useTheme2();

  return (
    <AutoSizer disableHeight>
      {({ width }) => (
        <TimelineChart
          frames={frames}
          timeRange={timeRange}
          timeZone={'browser'}
          mode={TimelineMode.Changes}
          height={18 * frames.length + 50}
          width={width}
          showValue={VisibilityMode.Never}
          theme={theme}
          rowHeight={0.8}
          legend={{
            calcs: [],
            displayMode: LegendDisplayMode.List,
            placement: 'bottom',
            showLegend: true,
          }}
          legendItems={[
            { label: 'Normal', color: theme.colors.success.main, yAxis: 1 },
            { label: 'Pending', color: theme.colors.warning.main, yAxis: 1 },
            { label: 'Recovering', color: theme.colors.warning.main, yAxis: 1 },
            { label: 'Firing', color: theme.colors.error.main, yAxis: 1 },
            { label: 'No Data', color: theme.colors.info.main, yAxis: 1 },
            { label: 'Mixed', color: theme.colors.text.secondary, yAxis: 1 },
          ]}
          replaceVariables={replaceVariables}
        />
      )}
    </AutoSizer>
  );
});

LogTimelineViewer.displayName = 'LogTimelineViewer';
