import { DataFrame, DataFrameView, TraceSpanRow } from '@grafana/data';

import transformTraceData from '../components/model/transform-trace-data';
import { Trace, TraceProcess, TraceResponse } from '../components/types/trace';

export function transformDataFrames(frame?: DataFrame): Trace | null {
  if (!frame) {
    return null;
  }
  let data: TraceResponse | null =
    frame.fields.length === 1
      ? // For backward compatibility when we sent whole json response in a single field/value
        frame.fields[0].values[0]
      : transformTraceDataFrame(frame);

  if (!data) {
    return null;
  }
  return transformTraceData(data);
}

export function transformTraceDataFrame(frame: DataFrame): TraceResponse | null {
  const view = new DataFrameView<TraceSpanRow>(frame);
  const processes: Record<string, TraceProcess> = {};
  for (let i = 0; i < view.length; i++) {
    const span = view.get(i);
    if (!span.spanID) {
      return null;
    }
    if (!processes[span.spanID]) {
      processes[span.spanID] = {
        serviceName: span.serviceName,
        tags: span.serviceTags,
      };
    }
  }

  return {
    traceID: view.get(0).traceID,
    processes,
    spans: view.toArray().map((s, index) => {
      const references = [];
      if (s.parentSpanID) {
        references.push({ refType: 'CHILD_OF' as const, spanID: s.parentSpanID, traceID: s.traceID });
      }
      if (s.references) {
        references.push(...s.references.map((reference) => ({ refType: 'FOLLOWS_FROM' as const, ...reference })));
      }
      return {
        ...s,
        duration: s.duration * 1000,
        startTime: s.startTime * 1000,
        processID: s.spanID,
        flags: 0,
        references,
        logs: s.logs?.map((l) => ({ ...l, timestamp: l.timestamp * 1000 })) || [],
        dataFrameRowIndex: index,
      };
    }),
  };
}
