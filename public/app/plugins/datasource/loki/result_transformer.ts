import { LokiLogsStream } from './types';
import { parseLabels, FieldType, Labels, DataFrameHelper } from '@grafana/data';

export function logStreamToDataFrame(stream: LokiLogsStream, refId?: string): DataFrameHelper {
  let labels: Labels = stream.parsedLabels;
  if (!labels && stream.labels) {
    labels = parseLabels(stream.labels);
  }
  const time: string[] = [];
  const lines: string[] = [];

  for (const entry of stream.entries) {
    time.push(entry.ts || entry.timestamp);
    lines.push(entry.line);
  }

  return new DataFrameHelper({
    refId,
    labels,
    fields: [
      { name: 'ts', type: FieldType.time, values: time }, // Time
      { name: 'line', type: FieldType.string, values: lines }, // Line
    ],
  });
}
