import { DataFrame } from '@grafana/data';
import { FieldWithStats } from 'app/features/logs/components/fieldSelector/FieldSelector';
import { parseLogsFrame } from 'app/features/logs/logsFrame';

export function getTableFieldsWithStats(dataFrame: DataFrame): FieldWithStats[] {
  const cardinality = new Map<string, number>();
  let totalLines = 0;
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

  const allFields = [...new Set([...labels, ...fields])];

  return allFields.map((label) => ({
    name: label,
    stats: {
      percentOfLinesWithLabel: Math.ceil((100 * (cardinality.get(label) ?? 0)) / totalLines),
    },
  }));
}
