import { type DataFrame, getFieldDisplayName } from '@grafana/data';

import { parseLogsFrame } from '../../logsFrame';

import { type FieldWithStats } from './FieldSelector';

/**
 * Maps field name -> display name for every field whose display name differs from
 * its name (e.g. via displayName/displayNameFromDS config). Covers all frame
 * fields, including labels, time and body, so suggested fields can reuse it.
 */
export function getFieldDisplayNames(dataFrames: DataFrame[]): Map<string, string> {
  const displayNames = new Map<string, string>();
  dataFrames.forEach((dataFrame) => {
    dataFrame.fields.forEach((field) => {
      const displayName = getFieldDisplayName(field, dataFrame);
      if (displayName !== field.name) {
        displayNames.set(field.name, displayName);
      }
    });
  });
  return displayNames;
}

/**
 * Fills in the display name for fields that don't already have one, using the provided map.
 */
export function withDisplayNames(fields: FieldWithStats[], displayNames: Map<string, string>): FieldWithStats[] {
  return fields.map((field) => ({
    ...field,
    displayName: field.displayName ?? displayNames.get(field.name),
  }));
}

export function getFieldsWithStats(dataFrames: DataFrame[]): FieldWithStats[] {
  const cardinality = new Map<string, number>();
  const displayNames = getFieldDisplayNames(dataFrames);
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

    const uniqueLabels = [...new Set(labels)];

    const fields = (logsFrame?.extraFields ?? [])
      .filter((field) => !field?.config?.custom?.hidden)
      .map((field) => {
        // The field is already present as a label, skip
        if (uniqueLabels.some((label) => label === field.name)) {
          return null;
        }
        const count = field.values.filter((value) => value !== null && value !== undefined).length;
        cardinality.set(field.name, (cardinality.get(field.name) ?? 0) + count);
        return field.name;
      })
      .filter((field) => field !== null);

    // Include severity field (level/detected_level) - it's excluded from extraFields but should be selectable
    const severityFieldNames: string[] = [];
    if (logsFrame?.severityField && !logsFrame.severityField.config?.custom?.hidden) {
      const count = logsFrame.severityField.values.filter((value) => value !== null && value !== undefined).length;
      cardinality.set(logsFrame.severityField.name, (cardinality.get(logsFrame.severityField.name) ?? 0) + count);
      severityFieldNames.push(logsFrame.severityField.name);
    }

    return [...uniqueLabels, ...fields, ...severityFieldNames];
  });

  const labels = [...new Set(allFields)];

  return labels.map((label) => ({
    name: label,
    displayName: displayNames.get(label),
    stats: {
      percentOfLinesWithLabel: Math.ceil((100 * (cardinality.get(label) ?? 0)) / totalLines),
    },
  }));
}
