import { css } from '@emotion/css';
import { SpanStatusCode } from '@opentelemetry/api';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FlameChartContainer } from '@grafana/flamechart';
import { useStyles2 } from '@grafana/ui';

import { getAbsoluteTime } from '../TraceTimelineViewer/SpanDetail';
import LabeledList from '../common/LabeledList';
import { KIND, STATUS, STATUS_MESSAGE } from '../constants/span';
import { TraceSpan } from '../types';
import { formatDuration } from '../utils/date';

interface TraceFlameChartTooltipPopoverProps {
  span: TraceSpan;
  container: FlameChartContainer<TraceSpan>;
}

export function TraceFlameChartTooltipPopover(props: TraceFlameChartTooltipPopoverProps): React.ReactElement {
  const { span, container } = props;

  const { process, duration, relativeStartTime, startTime } = span;

  const styles = useStyles2(getStyles);

  const overviewItems = [
    {
      key: 'svc',
      label: 'Service:',
      value: process.serviceName,
    },
    {
      key: 'duration',
      label: 'Duration:',
      value: formatDuration(duration),
    },
    {
      key: 'start',
      label: 'Start Time:',
      value: formatDuration(relativeStartTime) + getAbsoluteTime(startTime, container.timeZone),
    },
    ...(span.childSpanCount > 0
      ? [
          {
            key: 'child_count',
            label: 'Child Count:',
            value: span.childSpanCount,
          },
        ]
      : []),
  ];

  if (span.kind) {
    overviewItems.push({
      key: KIND,
      label: 'Kind:',
      value: span.kind,
    });
  }
  if (span.statusCode !== undefined) {
    overviewItems.push({
      key: STATUS,
      label: 'Status:',
      value: SpanStatusCode[span.statusCode].toLowerCase(),
    });
  }
  if (span.statusMessage) {
    overviewItems.push({
      key: STATUS_MESSAGE,
      label: 'Status Message:',
      value: span.statusMessage,
    });
  }

  return (
    <div className={styles.header}>
      <h2 className={styles.operationName} title={span.operationName}>
        {span.operationName}
      </h2>
      <div className={styles.listWrapper}>
        <LabeledList className={styles.list} items={overviewItems} />
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
