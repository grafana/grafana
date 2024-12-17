import { FlameChartContainer, Operation } from '@grafana/flamechart';

import { Trace, TraceSpan } from '../types';
import { getColorByKey } from '../utils/color-generator';

import { TraceFlameChartTooltipPopover } from './TraceFlameChartTooltipPopover';

export function traceToFlameChartContainer(trace: Trace, timeZone: string): FlameChartContainer<TraceSpan> {
  const id2operation: Record<string, Operation<TraceSpan>> = {};
  console.log('trace', trace);
  // instantiate operations
  trace.spans.forEach((span) => {
    id2operation[span.spanID] = {
      startMs: span.startTime / 1000,
      durationMs: span.duration / 1000,
      entity: span,
      children: [],
    };
  });

  trace.spans.forEach((span) => {
    const parentId = span.references.find((ref) => ref.refType === 'CHILD_OF')?.spanID;
    if (parentId) {
      const child = id2operation[span.spanID];
      const parent = id2operation[parentId];
      if (child && parent) {
        if (!child.parent) {
          child.parent = parent;
        }
        if (!parent.children.includes(child)) {
          parent.children.push(child);
        }
      }
    }
  });

  Object.values(id2operation).forEach((op) => {
    op.children.sort((a, b) => a.startMs - b.startMs);
  });

  return {
    timeZone,
    operations: Object.values(id2operation).filter((op) => !op.parent),
    getOperationName: (span: TraceSpan) => span.operationName,
    getOperationId: (span: TraceSpan) => span.spanID,
    getNodeBackgroundColor: (span, theme) => getColorByKey(span.process.serviceName, theme),
    isError: (span) => span.statusCode !== 0,
    renderNodeTooltip: (span, container) => <TraceFlameChartTooltipPopover span={span} container={container} />,
  };
}
