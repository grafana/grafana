import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FlameChart } from '@grafana/flamechart';
import { useStyles2 } from '@grafana/ui';

import { Trace } from '../types';

import { traceToFlameChartContainer } from './transforms';

interface TraceFlameChartProps {
  trace: Trace;
}

export function TraceFlameChart(props: TraceFlameChartProps) {
  const { trace } = props;

  const styles = useStyles2(getStyles);

  const container = useMemo(() => {
    return traceToFlameChartContainer(trace);
  }, [trace]);

  return (
    <div className={styles.container}>
      <FlameChart container={container} />
    </div>
  );
}
function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      minHeight: '600px',
      display: 'flex',
      flexDirection: 'column',
    }),
  };
}
