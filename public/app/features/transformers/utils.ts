import { useMemo } from 'react';

import { DataFrame, getFieldDisplayName } from '@grafana/data';

export function useAllFieldNamesFromDataFrames(input: DataFrame[]): string[] {
  return useMemo(() => {
    if (!Array.isArray(input)) {
      return [];
    }

    return Object.keys(
      input.reduce((names, frame) => {
        if (!frame || !Array.isArray(frame.fields)) {
          return names;
        }

        return frame.fields.reduce((names, field) => {
          const t = getFieldDisplayName(field, frame, input);
          names[t] = true;
          return names;
        }, names);
      }, {} as Record<string, boolean>)
    );
  }, [input]);
}

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
