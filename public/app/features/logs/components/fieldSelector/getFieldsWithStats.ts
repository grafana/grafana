import { DataFrame } from '@grafana/data';

import { parseLogsFrame } from '../../logsFrame';

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
        const count = field.values.filter((value) => value !== null && value !== undefined).length;
        cardinality.set(field.name, (cardinality.get(field.name) ?? 0) + count);
        return field.name;
      });

    // Include severity field (level/detected_level) - it's excluded from extraFields but should be selectable
    const severityFieldNames: string[] = [];
    if (logsFrame?.severityField && !logsFrame.severityField.config?.custom?.hidden) {
      const count = logsFrame.severityField.values.filter((value) => value !== null && value !== undefined).length;
      cardinality.set(logsFrame.severityField.name, (cardinality.get(logsFrame.severityField.name) ?? 0) + count);
      severityFieldNames.push(logsFrame.severityField.name);
    }

    return [...labels, ...fields, ...severityFieldNames];
  });

  const labels = [...new Set(allFields)];

  return labels.map((label) => ({
    name: label,
    stats: {
      percentOfLinesWithLabel: Math.ceil((100 * (cardinality.get(label) ?? 0)) / totalLines),
    },
  }));
}
