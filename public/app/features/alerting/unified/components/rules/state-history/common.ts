import { isEqual, uniqBy } from 'lodash';

import { GrafanaAlertStateWithReason } from 'app/types/unified-alerting-dto';

export interface Line {
  previous: GrafanaAlertStateWithReason;
  current: GrafanaAlertStateWithReason;
  values?: Record<string, number>;
  labels?: Record<string, string>;
  fingerprint?: string;
  ruleUID?: string;
  error?: string;
}

export interface LogRecord {
  timestamp: number;
  line: Line;
}

export type Label = [string, string];

// omit "common" labels from "labels"
export function omitLabels(labels: Label[], common: Label[]): Label[] {
  return labels.filter((label) => {
    return !common.find((commonLabel) => JSON.stringify(commonLabel) === JSON.stringify(label));
  });
}

// find all common labels by looking at which ones occur in every record, then create a unique array of items for those
export function extractCommonLabels(labels: Label[][]): Label[] {
  const flatLabels = labels.flatMap((label) => label);

  const commonLabels = uniqBy(
    flatLabels.filter((label) => {
      const count = flatLabels.filter((l) => isEqual(label, l)).length;
      return count === Object.keys(labels).length;
    }),
    (label) => JSON.stringify(label)
  );

  return commonLabels;
}
