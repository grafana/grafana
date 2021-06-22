import { useMemo } from 'react';
import { DataFrame, getFieldDisplayName, SelectableValue } from '@grafana/data';

/**
 * @internal
 */
export interface FrameFieldsDisplayNames {
  // The display names
  display: Set<string>;

  // raw field names (that are explicitly not visible)
  raw: Set<string>;
}

/**
 * @internal
 */
export function frameHasName(name: string | undefined, names: FrameFieldsDisplayNames) {
  if (!name) {
    return false;
  }
  return names.display.has(name) || names.raw.has(name);
}

/**
 * Retuns the distinct names in a set of frames
 */
function getFrameFieldsDisplayNames(data: DataFrame[]): FrameFieldsDisplayNames {
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
export function useFieldDisplayNames(data: DataFrame[]): FrameFieldsDisplayNames {
  return useMemo(() => {
    return getFrameFieldsDisplayNames(data);
  }, [data]);
}

/**
 * @internal
 */
export function useSelectOptions(
  displayNames: FrameFieldsDisplayNames,
  currentName?: string
): Array<SelectableValue<string>> {
  return useMemo(() => {
    let found = false;
    const options: Array<SelectableValue<string>> = [];
    for (const name of displayNames.display) {
      if (!found && name === currentName) {
        found = true;
      }
      options.push({
        value: name,
        label: name,
      });
    }
    for (const name of displayNames.raw) {
      if (!displayNames.display.has(name)) {
        if (!found && name === currentName) {
          found = true;
        }
        options.push({
          value: name,
          label: `${name} (base field name)`,
        });
      }
    }

    if (currentName && !found) {
      options.push({
        value: currentName,
        label: `${currentName} (not found)`,
      });
    }
    return options;
  }, [displayNames, currentName]);
}
