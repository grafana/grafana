import { useMemo } from 'react';

import { DataFrame, Field, getFieldDisplayName, FieldNamePickerBaseNameMode, FieldType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { MatcherScope } from '@grafana/schema';

import { getFieldTypeIcon } from '../../types/icon';
import { ComboboxOption } from '../Combobox/types';

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

  // if set, the scope to use for the field.
  scopes: Map<string, MatcherScope>;
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
  filter?: (field: Field) => boolean,
  existingNames?: FrameFieldsDisplayNames,
  parentData: DataFrame[] = data,
  scope?: MatcherScope
): FrameFieldsDisplayNames {
  const names =
    existingNames ??
    ({
      display: new Set(),
      raw: new Set(),
      fields: new Map(),
      scopes: new Map(),
    } satisfies FrameFieldsDisplayNames);

  for (const frame of data) {
    for (const field of frame.fields) {
      if (filter && !filter(field)) {
        continue;
      }
      if (field.type === FieldType.nestedFrames) {
        field.values.forEach((nestedData) =>
          getFrameFieldsDisplayNames(nestedData, filter, names, parentData, 'nested')
        );
        continue;
      }
      const disp = getFieldDisplayName(field, frame, parentData);
      names.display.add(disp);
      names.fields.set(disp, field);
      if (field.name && disp !== field.name) {
        names.raw.add(field.name);
        names.fields.set(field.name, field);
      }
      if (scope) {
        names.scopes.set(disp, scope);
      }
    }
  }
  return names;
}

/**
 * @internal
 */
export function getGroupLabelForScope(scope?: MatcherScope): string | undefined {
  switch (scope) {
    case 'nested':
      return t('grafana-ui.matchers.groups.nested', 'Nested fields');
    case 'annotation':
      return t('grafana-ui.matchers.groups.annotation', 'Annotations');
    case 'series':
    default:
      return t('grafana-ui.matchers.groups.series', 'Series');
  }
}

/**
 * @internal
 */
export function getGroupDescriptionForScope(scope: MatcherScope): string | undefined {
  switch (scope) {
    case 'nested':
      return t('grafana-ui.matchers.groups.nested.description', 'Fields from nested dataframes.');
    case 'annotation':
      return t('grafana-ui.matchers.groups.annotation.description', 'Annotations series for this panel.');
    case 'series':
      return t('grafana-ui.matchers.groups.series.description', 'Fields from the dataframes in this panel.');
    default:
      return undefined;
  }
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
  firstItem?: ComboboxOption,
  fieldType?: string,
  baseNameMode?: FieldNamePickerBaseNameMode
): ComboboxOption[] {
  return useMemo(() => {
    let found = false;

    const shouldShowScopes = displayNames.scopes.size > 0;

    const options: ComboboxOption[] = [];
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
          label: t('grafana-ui.matchers.labels.base-field-name', '{{name}} (base field name)', { name }),
          group: shouldShowScopes ? getGroupLabelForScope(displayNames.scopes.get(name)) : undefined,
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
            group: shouldShowScopes ? getGroupLabelForScope(displayNames.scopes.get(name)) : undefined,
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
              label: t('grafana-ui.matchers.labels.base-field-name', '{{name}} (base field name)', { name }),
              group: shouldShowScopes ? getGroupLabelForScope(displayNames.scopes.get(name)) : undefined,
            });
          }
        }
      }
    }

    if (currentName && !found) {
      options.push({
        value: currentName,
        label: t('grafana-ui.matchers.labels.not-found', '{{name}} (not found)', { name: currentName }),
        group: shouldShowScopes ? getGroupLabelForScope(displayNames.scopes.get(currentName)) : undefined,
      });
    }

    return options;
  }, [displayNames, currentName, firstItem, fieldType, baseNameMode]);
}

/**
 * @internal
 */
export function useScopesOptions(
  uniqScopes: Set<MatcherScope>,
  currentScope?: MatcherScope
): Array<ComboboxOption<MatcherScope>> {
  return useMemo(() => {
    // Remove the series scope from the set, so we can gaurantee it's the first option, and also
    // because it's the default scope, so if it's the only one detected, we should not show the scope selector.
    uniqScopes.delete('series');

    const scopeNotFound = currentScope && currentScope !== 'series' && !uniqScopes.has(currentScope);

    if (uniqScopes.size === 0 && !scopeNotFound) {
      return [];
    }

    const arr: Array<ComboboxOption<MatcherScope>> = [
      {
        label: getGroupLabelForScope('series'),
        description: getGroupDescriptionForScope('series'),
        value: 'series',
      },
    ];

    for (const scope of uniqScopes) {
      arr.push({
        label: getGroupLabelForScope(scope),
        description: getGroupDescriptionForScope(scope),
        value: scope,
      });
    }

    if (scopeNotFound) {
      const innerLabel = getGroupLabelForScope(currentScope);

      arr.push({
        label: t('grafana-ui.matchers.labels.not-found', '{{name}} (not found)', { name: innerLabel }),
        description: getGroupDescriptionForScope(currentScope),
        value: currentScope,
      });
    }

    return arr;
  }, [uniqScopes, currentScope]);
}
