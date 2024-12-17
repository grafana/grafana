import { SpanStatusCode } from '@opentelemetry/api';
import React from 'react';

import LabeledList from '../../common/LabeledList';
import { KIND, LIBRARY_NAME, LIBRARY_VERSION, STATUS, STATUS_MESSAGE, TRACE_STATE } from '../../constants/span';
import { TraceSpan } from '../../types';
import { formatDuration } from '../utils';

import { getAbsoluteTime } from '.';

interface SpanOverviewListProps {
  span: TraceSpan;
  timeZone: string;
  className?: string;
  divider?: boolean;
}

export function SpanOverviewList(props: SpanOverviewListProps): React.ReactElement {
  const { span, divider, className, timeZone } = props;
  const { process, duration, relativeStartTime, startTime } = span;

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
      value: formatDuration(relativeStartTime) + getAbsoluteTime(startTime, timeZone),
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

  if (span.instrumentationLibraryName) {
    overviewItems.push({
      key: LIBRARY_NAME,
      label: 'Library Name:',
      value: span.instrumentationLibraryName,
    });
  }
  if (span.instrumentationLibraryVersion) {
    overviewItems.push({
      key: LIBRARY_VERSION,
      label: 'Library Version:',
      value: span.instrumentationLibraryVersion,
    });
  }
  if (span.traceState) {
    overviewItems.push({
      key: TRACE_STATE,
      label: 'Trace State:',
      value: span.traceState,
    });
  }

  return <LabeledList className={className} divider={divider} items={overviewItems} />;
}
