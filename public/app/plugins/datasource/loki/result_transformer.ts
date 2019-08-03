import { LokiLogsStream } from './types';
import { parseLabels, FieldType, Labels, DataFrameHelper } from '@grafana/data';

export function logStreamToDataFrame(stream: LokiLogsStream): DataFrameHelper {
  let labels: Labels = stream.parsedLabels;
  if (!labels && stream.labels) {
    labels = parseLabels(stream.labels);
  }
  const data = new DataFrameHelper({
    labels,
    fields: [{ name: 'ts', type: FieldType.time, values: [] }, { name: 'line', type: FieldType.string, values: [] }],
  });
  for (const entry of stream.entries) {
    data.fields[0].values.push(entry.ts || entry.timestamp);
    data.fields[1].values.push(entry.line);
  }
  return data;
}
