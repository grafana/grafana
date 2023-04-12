import { isEqual, uniqBy } from 'lodash';

import { GrafanaAlertStateWithReason } from 'app/types/unified-alerting-dto';

export interface Line {
  previous: GrafanaAlertStateWithReason;
  current: GrafanaAlertStateWithReason;
  values?: Record<string, number>;
  labels?: Record<string, string>;
}

export interface LogRecord {
  timestamp: number;
  line: Line;
}

// omit "common" labels from "labels"
export function omitLabels(labels: Array<[string, string]>, common: Array<[string, string]>): Array<[string, string]> {
  return labels.filter((label) => {
    return !common.find((l) => JSON.stringify(l) === JSON.stringify(label));
  });
}

export function extractCommonLabels(groupedLines: Record<string, LogRecord[]>): Array<[string, string]> {
  const groupLabels = Object.keys(groupedLines);
  const groupLabelsArray: Array<[string, string]> = groupLabels.flatMap((label) => Object.entries(JSON.parse(label)));

  // find all common labels by looking and which ones occur in every record, then create a unique array of items for those
  const commonLabels = uniqBy(
    groupLabelsArray.filter((label) => {
      const count = groupLabelsArray.filter((l) => isEqual(label, l)).length;
      return count === Object.keys(groupedLines).length;
    }),
    (label) => JSON.stringify(label)
  );

  return commonLabels;
}
