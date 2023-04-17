import React, { useEffect, useRef } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { BehaviorSubject } from 'rxjs';

import { DataFrame, TimeRange } from '@grafana/data';
import { VisibilityMode } from '@grafana/schema';
import { LegendDisplayMode, useTheme2 } from '@grafana/ui';
import { TimelineChart } from 'app/core/components/TimelineChart/TimelineChart';
import { TimelineMode } from 'app/core/components/TimelineChart/utils';

interface LogTimelineViewerProps {
  frames: DataFrame[];
  timeRange: TimeRange;
  onPointerMove?: (seriesIdx: number, pointerIdx: number) => void;
}

export const LogTimelineViewer = React.memo(({ frames, timeRange, onPointerMove }: LogTimelineViewerProps) => {
  const theme = useTheme2();

  const pointerSubject = useRef(
    new BehaviorSubject<{ seriesIdx: number; pointIdx: number }>({ seriesIdx: 0, pointIdx: 0 })
  );

  useEffect(() => {
    const subscription = pointerSubject.current.subscribe(({ seriesIdx, pointIdx }) => {
      onPointerMove && onPointerMove(seriesIdx, pointIdx);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [onPointerMove]);

  return (
    <AutoSizer disableHeight>
      {({ width }) => (
        <TimelineChart
          frames={frames}
          timeRange={timeRange}
          timeZone={'browser'}
          mode={TimelineMode.Changes}
          height={20 * frames.length + 40}
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
            { label: 'Alerting', color: theme.colors.error.main, yAxis: 1 },
            { label: 'NoData', color: theme.colors.info.main, yAxis: 1 },
          ]}
        >
          {(builder) => {
            builder.setSync();
            const interpolator = builder.getTooltipInterpolator();

            // I found this in TooltipPlugin.tsx
            if (interpolator) {
              builder.addHook('setCursor', (u) => {
                interpolator(
                  (seriesIdx) => {
                    if (seriesIdx) {
                      const currentPointer = pointerSubject.current.getValue();
                      pointerSubject.current.next({ ...currentPointer, seriesIdx });
                    }
                  },
                  (pointIdx) => {
                    if (pointIdx) {
                      const currentPointer = pointerSubject.current.getValue();
                      pointerSubject.current.next({ ...currentPointer, pointIdx });
                    }
                  },
                  () => {},
                  u
                );
              });
            }

            return <></>; // Just to satisfy the type checker
          }}
        </TimelineChart>
      )}
    </AutoSizer>
  );
});

LogTimelineViewer.displayName = 'LogTimelineViewer';
