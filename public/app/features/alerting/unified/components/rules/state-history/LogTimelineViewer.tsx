import { memo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { type DataFrame, type InterpolateFunction, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { VisibilityMode } from '@grafana/schema';
import { useTheme2 } from '@grafana/ui/themes';
import { LegendDisplayMode } from '@grafana/ui/types';
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
            {
              label: t('alerting.log-timeline-viewer.label.normal', 'Normal'),
              color: theme.colors.success.main,
              yAxis: 1,
            },
            {
              label: t('alerting.log-timeline-viewer.label.pending', 'Pending'),
              color: theme.colors.warning.main,
              yAxis: 1,
            },
            {
              label: t('alerting.log-timeline-viewer.label.recovering', 'Recovering'),
              color: theme.colors.warning.main,
              yAxis: 1,
            },
            {
              label: t('alerting.log-timeline-viewer.label.firing', 'Firing'),
              color: theme.colors.error.main,
              yAxis: 1,
            },
            {
              label: t('alerting.log-timeline-viewer.label.no-data', 'No Data'),
              color: theme.colors.info.main,
              yAxis: 1,
            },
            {
              label: t('alerting.log-timeline-viewer.label.mixed', 'Mixed'),
              color: theme.colors.text.secondary,
              yAxis: 1,
            },
          ]}
          replaceVariables={replaceVariables}
        />
      )}
    </AutoSizer>
  );
});

LogTimelineViewer.displayName = 'LogTimelineViewer';
