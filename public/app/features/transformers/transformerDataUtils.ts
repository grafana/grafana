import { type DataFrame } from '@grafana/data';

import { variableRegex } from '../variables/variableRegex';

// Data-only helpers, kept apart from ./utils (which also holds React hooks and UI helpers) so the
// transformations that use them can run outside the browser, in the transform sidecar.

export function getDistinctLabels(input: DataFrame[]): Set<string> {
  const distinct = new Set<string>();
  for (const frame of input) {
    for (const field of frame.fields) {
      if (field.labels) {
        for (const k of Object.keys(field.labels)) {
          distinct.add(k);
        }
      }
    }
  }
  return distinct;
}

export const numberOrVariableValidator = (value: string | number) => {
  if (typeof value === 'number') {
    return true;
  }
  if (!Number.isNaN(Number(value))) {
    return true;
  }
  const variableFound = variableRegex.test(value);
  variableRegex.lastIndex = 0;
  if (variableFound) {
    return true;
  }
  return false;
};
