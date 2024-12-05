import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FlameChart } from '@grafana/flamechart';
import { useStyles2 } from '@grafana/ui';

import { autoColor } from '../Theme';
import Ticks from '../TraceTimelineViewer/Ticks';
import TimelineViewingLayer from '../TraceTimelineViewer/TimelineHeaderRow/TimelineViewingLayer';
import { TUpdateViewRangeTimeFunction, ViewRange, ViewRangeTimeUpdate } from '../TraceTimelineViewer/types';
import { Trace } from '../types';

import { traceToFlameChartContainer } from './transforms';

const NUM_TICKS = 8;

interface TraceFlameChartProps {
  trace: Trace;
  timeZone: string;
  viewRange: ViewRange;
  updateNextViewRangeTime: (update: ViewRangeTimeUpdate) => void;
  updateViewRangeTime: TUpdateViewRangeTimeFunction;
}

export function TraceFlameChart(props: TraceFlameChartProps) {
  const { trace, viewRange, updateNextViewRangeTime, updateViewRangeTime, timeZone } = props;

  const styles = useStyles2(getStyles);
  const container = useMemo(() => {
    return traceToFlameChartContainer(trace, timeZone);
  }, [trace, timeZone]);

  const [viewStart, viewEnd] = viewRange.time.current;

  return (
    <div className={styles.container}>
      <div className={styles.viewingLayer}>
        <TimelineViewingLayer
          boundsInvalidator={null}
          updateNextViewRangeTime={updateNextViewRangeTime}
          updateViewRangeTime={updateViewRangeTime}
          viewRangeTime={viewRange.time}
        />
        <Ticks
          numTicks={NUM_TICKS}
          startTime={viewStart * trace.duration}
          endTime={viewEnd * trace.duration}
          showLabels
        />
      </div>
      <div className={styles.chartContainer}>
        <Ticks numTicks={NUM_TICKS} />
        <FlameChart viewRange={viewRange} container={container} />
      </div>
    </div>
  );
}
function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      minHeight: '600px',
      overflow: 'hidden',
    }),
    viewingLayer: css({
      position: 'relative',
      height: '38px',
      lineHeight: '38px',
      background: autoColor(theme, '#ececec'),
      borderBottom: `1px solid ${autoColor(theme, '#ccc')}`,
    }),
    chartContainer: css({
      paddingTop: theme.spacing(1),
      position: 'relative',
    }),
  };
}
