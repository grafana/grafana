import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FlameChartContainer } from '@grafana/flamechart';
import { useStyles2 } from '@grafana/ui';

import { SpanOverviewList } from '../TraceTimelineViewer/SpanDetail/SpanOverviewList';
import { TraceSpan } from '../types';

interface TraceFlameChartTooltipPopoverProps {
  span: TraceSpan;
  container: FlameChartContainer<TraceSpan>;
}

export function TraceFlameChartTooltipPopover(props: TraceFlameChartTooltipPopoverProps): React.ReactElement {
  const { span, container } = props;

  const styles = useStyles2(getStyles);

  return (
    <div className={styles.header}>
      <h2 className={styles.operationName} title={span.operationName}>
        {span.operationName}
      </h2>
      <div className={styles.listWrapper}>
        <SpanOverviewList className={styles.list} span={span} timeZone={container.timeZone} />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css({}),
    listWrapper: css({
      overflow: 'hidden',
    }),
    list: css({
      textAlign: 'left',
    }),
    operationName: css({
      margin: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flexBasis: '50%',
      flexGrow: 0,
      flexShrink: 0,
    }),
  };
};
