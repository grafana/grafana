import { LokiLogsStream } from './types';
import { parseLabels, FieldType, Labels, DataFrame, ArrayVector } from '@grafana/data';

export function logStreamToDataFrame(stream: LokiLogsStream, reverse?: boolean, refId?: string): DataFrame {
  let labels: Labels = stream.parsedLabels;
  if (!labels && stream.labels) {
    labels = parseLabels(stream.labels);
  }
  const times = new ArrayVector<string>([]);
  const lines = new ArrayVector<string>([]);

  for (const entry of stream.entries) {
    times.add(entry.ts || entry.timestamp);
    lines.add(entry.line);
  }

  if (reverse) {
    times.buffer = times.buffer.reverse();
    lines.buffer = lines.buffer.reverse();
  }

  return {
    refId,
    labels,
    fields: [
      { name: 'ts', type: FieldType.time, config: { title: 'Time' }, values: times }, // Time
      { name: 'line', type: FieldType.string, config: {}, values: lines }, // Line
    ],
    length: times.length,
  };
}
