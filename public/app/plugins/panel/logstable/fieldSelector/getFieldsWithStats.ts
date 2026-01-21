import { DataFrame } from '@grafana/data';
import { parseLogsFrame } from 'app/features/logs/logsFrame';

import { FieldWithStats } from './FieldSelector';

export function getFieldsWithStats(dataFrames: DataFrame[]): FieldWithStats[] {
  const cardinality = new Map<string, number>();
  let totalLines = 0;
  const allFields = dataFrames.flatMap((dataFrame) => {
    const logsFrame = parseLogsFrame(dataFrame);
    totalLines += dataFrame.length;

    const labelValues = logsFrame?.getLogFrameLabelsAsLabels();
    const labels =
      labelValues?.flatMap((labels) => {
        const keys = Object.keys(labels);
        keys.forEach((key) => cardinality.set(key, (cardinality.get(key) ?? 0) + 1));
        return keys;
      }) ?? [];

    const fields = (logsFrame?.extraFields ?? [])
      .filter((field) => !field?.config?.custom?.hidden)
      .map((field) => {
        cardinality.set(field.name, field.values.filter((value) => value !== null && value !== undefined).length);
        return field.name;
      });

    return [...labels, ...fields];
  });

  const labels = [...new Set(allFields)];

  return labels.map((label) => ({
    name: label,
    stats: {
      percentOfLinesWithLabel: Math.ceil((100 * (cardinality.get(label) ?? 0)) / totalLines),
    },
  }));
}
