import { LokiLogsStream } from './types';
import { DataFrame, parseLabels, FieldType, Labels } from '@grafana/data';

export function logStreamToDataFrame(stream: LokiLogsStream): DataFrame {
  let labels: Labels = stream.parsedLabels;
  if (!labels && stream.labels) {
    labels = parseLabels(stream.labels);
  }
  return {
    labels,
    fields: [{ name: 'ts', type: FieldType.time }, { name: 'line', type: FieldType.string }],
    rows: stream.entries.map(entry => {
      return [entry.ts || entry.timestamp, entry.line];
    }),
  };
}
