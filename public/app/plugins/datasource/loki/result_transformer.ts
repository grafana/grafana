import { LokiLogsStream } from './types';
import { parseLabels, FieldType, Labels, DataFrame, ArrayVector } from '@grafana/data';

export function logStreamToDataFrame(stream: LokiLogsStream, reverse?: boolean, refId?: string): DataFrame {
  let labels: Labels = stream.parsedLabels;
  if (!labels && stream.labels) {
    labels = parseLabels(stream.labels);
  }
  const time = new ArrayVector<string>([]);
  const lines = new ArrayVector<string>([]);

  for (const entry of stream.entries) {
    time.buffer.push(entry.ts || entry.timestamp);
    lines.buffer.push(entry.line);
  }
  if (reverse) {
    time.buffer = time.buffer.reverse();
    lines.buffer = lines.buffer.reverse();
  }

  return {
    refId,
    labels,
    fields: [
      { name: 'ts', type: FieldType.time, config: {}, values: time }, // Time
      { name: 'line', type: FieldType.string, config: {}, values: lines }, // Line
    ],
    length: time.length,
  };
}
