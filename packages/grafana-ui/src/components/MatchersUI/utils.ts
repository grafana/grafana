import { useMemo } from 'react';
import { DataFrame, getFieldDisplayName } from '@grafana/data';

/**
 * This represents the set of distinct names in a frame
 *
 * @internal
 */
export interface FrameFieldsDisplayNames {
  // The display names
  display: Set<string>;

  // raw field names (that are explicitly not visible)
  raw: Set<string>;
}

/**
 * Retuns the distinct names in a set of frames
 *
 * @internal
 */
export function getFrameFieldsDisplayNames(data: DataFrame[]): FrameFieldsDisplayNames {
  const names: FrameFieldsDisplayNames = {
    display: new Set<string>(),
    raw: new Set<string>(),
  };

  for (const frame of data) {
    for (const field of frame.fields) {
      const disp = getFieldDisplayName(field, frame, data);
      names.display.add(disp);
      if (field.name && disp !== field.name) {
        names.raw.add(field.name);
      }
    }
  }
  return names;
}

/**
 * @internal
 */
export function useFrameFieldsDisplayNames(data: DataFrame[]): FrameFieldsDisplayNames {
  return useMemo(() => {
    return getFrameFieldsDisplayNames(data);
  }, [data]);
}
