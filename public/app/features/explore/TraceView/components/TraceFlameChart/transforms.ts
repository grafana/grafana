import { FlameChartContainer, Operation } from '@grafana/flamechart';

import { Trace, TraceSpan } from '../types';
import { getColorByKey } from '../utils/color-generator';

export function traceToFlameChartContainer(trace: Trace): FlameChartContainer<TraceSpan> {
  const id2operation: Record<string, Operation<TraceSpan>> = {};

  // instantiate operations
  trace.spans.forEach((span) => {
    id2operation[span.spanID] = {
      startMs: span.startTime / 1000,
      durationMs: span.duration / 1000,
      entity: span,
      children: [],
    };
  });

  // define parent/child relationships
  trace.spans.forEach((span) => {
    const operation = id2operation[span.spanID];
    if (span.childSpanIds) {
      span.childSpanIds.forEach((childSpanId) => {
        const childOperation = id2operation[childSpanId];
        if (childOperation) {
          operation.children.push(childOperation);
          childOperation.parent = operation;
        }
      });
    }
  });

  return {
    operations: Object.values(id2operation).filter((op) => !op.parent),
    getOperationName: (span: TraceSpan) => span.operationName,
    getOperationId: (span: TraceSpan) => span.spanID,
    getNodeBackgroundColor: (span, theme) => getColorByKey(span.process.serviceName, theme),
  };
}
