import { useMemo } from 'react';

import { type DataFrame, type Field, getFieldDisplayName, FieldNamePickerBaseNameMode, FieldType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type MatcherScope } from '@grafana/schema';

import { getFieldTypeIcon } from '../../types/icon';
import { type ComboboxOption } from '../Combobox/types';

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
  scope: MatcherScope = 'series'
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
      names.scopes.set(disp, scope);

      if (field.name && disp !== field.name) {
        names.raw.add(field.name);
        names.fields.set(field.name, field);
        names.scopes.set(field.name, scope);
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
      return t('grafana-ui.matchers.groups.nested', 'Nested');
    case 'annotation':
      return t('grafana-ui.matchers.groups.annotation', 'Annotations');
    case 'exemplar':
      return t('grafana-ui.matchers.groups.exemplar', 'Exemplars');
    case 'series':
    default:
      return t('grafana-ui.matchers.groups.series', 'Dataframe');
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
    case 'exemplar':
      return t('grafana-ui.matchers.groups.exemplar.description', 'Trace exemplars for this panel.');
    default:
      return undefined;
  }
}

/**
 * @internal
 */
export function useFieldDisplayNames(
  data: DataFrame[],
  filter?: (field: Field) => boolean,
  scope?: MatcherScope
): FrameFieldsDisplayNames {
  return useMemo(() => getFrameFieldsDisplayNames(data, filter, undefined, undefined, scope), [data, filter, scope]);
}

interface UseMatcherSelectOptionsProps {
  /**
   * An additional first option to add to the beginning of the list. This is useful for an "All" option, for example.
   */
  firstItem?: ComboboxOption;
  /**
   * if set, filter the options by field type.
   */
  fieldType?: string;
  /**
   * this controls whether and how entries are added to the combobox fo the base field name of a field with a display name.
   */
  baseNameMode?: FieldNamePickerBaseNameMode;
  /**
   * if set, filter the options by matcher scope.
   */
  scope?: MatcherScope;
}

/**
 * @internal
 * given the FrameFieldsDisplayNames object other configuration options, this builds the options for the combobox, grouped by matcher scope.
 * this is intended to be used by consumers of the MatchersUI, like FieldNamePicker and FieldTypeMatcherEditor. There are optional configuration
 * options to augment and control the contents of the list.
 */
export function useMatcherSelectOptions(
  displayNames: FrameFieldsDisplayNames,
  currentName?: string,
  { firstItem, fieldType, baseNameMode, scope }: UseMatcherSelectOptionsProps = {}
): ComboboxOption[] {
  return useMemo(() => {
    let found = false;

    const uniqueScopes = new Set(displayNames.scopes.values());
    const shouldShowScopes = !scope && uniqueScopes.size > 1;
    const isFound = (name: string) => name === currentName && (scope ? displayNames.scopes.get(name) === scope : true);
    const getGroup = (name: string) =>
      shouldShowScopes ? getGroupLabelForScope(displayNames.scopes.get(name)) : undefined;
    const optionFactory =
      (getLabel: (name: string) => string, getExtraOptions?: (name: string) => Partial<ComboboxOption> | undefined) =>
      (name: string) => ({
        value: name,
        label: getLabel(name),
        group: getGroup(name),
        ...getExtraOptions?.(name),
      });

    const displayNameBuilder = optionFactory(
      (name) => name,
      (name) => {
        const field = displayNames.fields.get(name);
        if (!field) {
          return;
        }
        return { icon: getFieldTypeIcon(field) };
      }
    );
    const baseFieldNameBuilder = optionFactory((name) =>
      t('grafana-ui.matchers.labels.base-field-name', '{{name}} (base field name)', { name })
    );

    let options: ComboboxOption[] = [];
    if (firstItem) {
      options.push(firstItem);
    }

    // the list order and contents of the list depends on the baseNameMode
    const sets: Array<{ set: Set<string>; builder: (name: string) => ComboboxOption }> = [];
    if (baseNameMode === FieldNamePickerBaseNameMode.OnlyBaseNames) {
      sets.push({ set: displayNames.raw, builder: baseFieldNameBuilder });
    } else {
      sets.push({ set: displayNames.display, builder: displayNameBuilder });
    }
    if (baseNameMode !== FieldNamePickerBaseNameMode.ExcludeBaseNames) {
      sets.push({ set: displayNames.raw, builder: baseFieldNameBuilder });
    }

    for (const { set, builder } of sets) {
      const shouldCheckFieldType = fieldType && set === displayNames.display;
      for (const name of set) {
        if (!found && isFound(name)) {
          found = true;
        }
        if (scope && displayNames.scopes.get(name) !== scope) {
          continue;
        }
        if (shouldCheckFieldType && fieldType !== displayNames.fields.get(name)?.type) {
          continue;
        }
        options.push(builder(name));
      }
    }

    if (currentName && !found) {
      const notFoundOption = optionFactory((name) =>
        t('grafana-ui.matchers.labels.not-found', '{{name}} (not found)', { name })
      );
      options.push(notFoundOption(currentName));
    }

    return options;
  }, [baseNameMode, currentName, displayNames, fieldType, firstItem, scope]);
}

export function getUniqueMatcherScopes(data: DataFrame[]): Set<MatcherScope> {
  return new Set([...getFrameFieldsDisplayNames(data).scopes.values()]);
}
