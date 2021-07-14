import { DataFrame, getFieldDisplayName } from '@grafana/data';
import { useMemo } from 'react';

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
