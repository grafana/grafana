import { LokiLogsStream } from './types';
import { SeriesData, parseLabels, FieldType, Labels } from '@grafana/ui';

export function logStreamToSeriesData(stream: LokiLogsStream): SeriesData {
  let labels: Labels = stream.parsedLabels;
  if (!labels && stream.labels) {
    labels = parseLabels(stream.labels);
  }
  return {
    labels,
    fields: [{ name: 'time', type: FieldType.time }, { name: 'message', type: FieldType.string }],
    rows: stream.entries.map(entry => {
      return [entry.ts || entry.timestamp, entry.line];
    }),
  };
}
