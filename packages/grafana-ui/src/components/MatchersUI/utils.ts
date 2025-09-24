import { useMemo } from 'react';

import { DataFrame, Field, getFieldDisplayName, SelectableValue, FieldNamePickerBaseNameMode } from '@grafana/data';

import { getFieldTypeIcon } from '../../types/icon';

/**
 * @internal
 */
export interface FrameFieldsDisplayNames {
  // The display names
  display: Set<string>;

  // raw field names (that are explicitly not visible)
  raw: Set<string>;

  // Field mappings (duplicates are not supported)
  fields: Map<string, Field>;
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
 * Returns the distinct names in a set of frames
 */
export function getFrameFieldsDisplayNames(
  data: DataFrame[],
  filter?: (field: Field) => boolean
): FrameFieldsDisplayNames {
  const names: FrameFieldsDisplayNames = {
    display: new Set<string>(),
    raw: new Set<string>(),
    fields: new Map<string, Field>(),
  };

  for (const frame of data) {
    for (const field of frame.fields) {
      if (filter && !filter(field)) {
        continue;
      }
      const disp = getFieldDisplayName(field, frame, data);
      names.display.add(disp);
      names.fields.set(disp, field);
      if (field.name && disp !== field.name) {
        names.raw.add(field.name);
        names.fields.set(field.name, field);
      }
    }
  }
  return names;
}

/**
 * @internal
 */
export function useFieldDisplayNames(data: DataFrame[], filter?: (field: Field) => boolean): FrameFieldsDisplayNames {
  return useMemo(() => {
    return getFrameFieldsDisplayNames(data, filter);
  }, [data, filter]);
}

/**
 * @internal
 */
export function useSelectOptions(
  displayNames: FrameFieldsDisplayNames,
  currentName?: string,
  firstItem?: SelectableValue<string>,
  fieldType?: string,
  baseNameMode?: FieldNamePickerBaseNameMode
): Array<SelectableValue<string>> {
  return useMemo(() => {
    let found = false;
    const options: Array<SelectableValue<string>> = [];
    if (firstItem) {
      options.push(firstItem);
    }
    if (baseNameMode === FieldNamePickerBaseNameMode.OnlyBaseNames) {
      for (const name of displayNames.raw) {
        if (!found && name === currentName) {
          found = true;
        }
        options.push({
          value: name,
          label: `${name} (base field name)`,
        });
      }
    } else {
      for (const name of displayNames.display) {
        if (!found && name === currentName) {
          found = true;
        }
        const field = displayNames.fields.get(name);
        if (!fieldType || fieldType === field?.type) {
          options.push({
            value: name,
            label: name,
            icon: field ? getFieldTypeIcon(field) : undefined,
          });
        }
      }

      if (baseNameMode !== FieldNamePickerBaseNameMode.ExcludeBaseNames) {
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
      }
    }

    if (currentName && !found) {
      options.push({
        value: currentName,
        label: `${currentName} (not found)`,
      });
    }
    return options;
  }, [displayNames, currentName, firstItem, fieldType, baseNameMode]);
}
