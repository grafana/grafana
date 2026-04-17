import { memo, useCallback, useMemo } from 'react';

import { type DataFrame, FieldMatcherID, fieldMatchers, FieldType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type MatcherScope } from '@grafana/schema';

import { getFieldTypeIconName } from '../../types/icon';
import { Combobox } from '../Combobox/Combobox';
import { type ComboboxOption } from '../Combobox/types';
import { Stack } from '../Layout/Stack/Stack';

import { type FieldMatcherUIRegistryItem, type MatcherUIProps } from './types';

export const FieldTypeMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { data, options, onChange: onChangeFromProps, id, scope = 'series' } = props;
  const counts = useFieldCounts(data);
  const selectOptions = useCountSelectOptions(counts, scope, options);

  const onChange = useCallback(
    (selection: ComboboxOption) => {
      return onChangeFromProps(selection.value!);
    },
    [onChangeFromProps]
  );

  const selectedOption = selectOptions.find((v) => v.value === options);
  return (
    <Stack direction="column" gap={1}>
      <Combobox id={id} value={selectedOption} options={selectOptions} onChange={onChange} />
    </Stack>
  );
});
FieldTypeMatcherEditor.displayName = 'FieldTypeMatcherEditor';

// Select options for all field types.
// This is not exported to the published package, but used internally
export const getAllFieldTypeIconOptions: () => Array<ComboboxOption<FieldType>> = () => [
  {
    value: FieldType.number,
    label: t('grafana-ui.matchers-ui.get-all-field-type-icon-options.label-number', 'Number'),
    icon: getFieldTypeIconName(FieldType.number),
  },
  {
    value: FieldType.string,
    label: t('grafana-ui.matchers-ui.get-all-field-type-icon-options.label-string', 'String'),
    icon: getFieldTypeIconName(FieldType.string),
  },
  {
    value: FieldType.time,
    label: t('grafana-ui.matchers-ui.get-all-field-type-icon-options.label-time', 'Time'),
    icon: getFieldTypeIconName(FieldType.time),
  },
  {
    value: FieldType.boolean,
    label: t('grafana-ui.matchers-ui.get-all-field-type-icon-options.label-boolean', 'Boolean'),
    icon: getFieldTypeIconName(FieldType.boolean),
  },
  {
    value: FieldType.trace,
    label: t('grafana-ui.matchers-ui.get-all-field-type-icon-options.label-traces', 'Traces'),
    icon: getFieldTypeIconName(FieldType.trace),
  },
  {
    value: FieldType.enum,
    label: t('grafana-ui.matchers-ui.get-all-field-type-icon-options.label-enum', 'Enum'),
    icon: getFieldTypeIconName(FieldType.enum),
  },
  {
    value: FieldType.other,
    label: t('grafana-ui.matchers-ui.get-all-field-type-icon-options.label-other', 'Other'),
    icon: getFieldTypeIconName(FieldType.other),
  },
];

type ScopedCounts = Map<MatcherScope, Map<FieldType, number>>;

export const countScopedFields = (
  data: DataFrame[],
  scopeCounts: ScopedCounts = new Map(),
  scope: MatcherScope = 'series'
): ScopedCounts => {
  let counts = scopeCounts.get(scope);
  if (!counts) {
    counts = new Map();
    scopeCounts.set(scope, counts);
  }

  for (const t of getAllFieldTypeIconOptions()) {
    counts.set(t.value!, 0);
  }

  for (const frame of data) {
    for (const field of frame.fields) {
      const key = field.type || FieldType.other;
      if (key === FieldType.nestedFrames) {
        countScopedFields(field.values[0], scopeCounts, 'nested');
        continue;
      }
      let v = counts.get(key);
      if (!v) {
        v = 0;
      }
      counts.set(key, v + 1);
    }
  }

  return scopeCounts;
};

const useFieldCounts = (data: DataFrame[]): ScopedCounts => {
  return useMemo(() => countScopedFields(data), [data]);
};

const useCountSelectOptions = (counts: ScopedCounts, scope: MatcherScope, opt?: string): ComboboxOption[] => {
  return useMemo(() => {
    let found = false;
    const options: ComboboxOption[] = [];
    for (const t of getAllFieldTypeIconOptions()) {
      const count = counts.get(scope ?? 'series')?.get(t.value!) ?? 0;
      const match = opt === t.value;
      if (count || match) {
        options.push({
          ...t,
          label: `${t.label} (${count})`,
        });
      }
      if (match) {
        found = true;
      }
    }
    if (opt && !found) {
      options.push({
        value: opt,
        label: `${opt} (No matches)`,
      });
    }
    return options;
  }, [counts, opt, scope]);
};

export const getFieldTypeMatcherItem: () => FieldMatcherUIRegistryItem<string> = () => ({
  id: FieldMatcherID.byType,
  component: FieldTypeMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byType),
  name: t('grafana-ui.matchers-ui.name-fields-with-type', 'Fields with type'),
  description: t(
    'grafana-ui.matchers-ui.description-fields-with-type',
    'Set properties for fields of a specific type (number, string, boolean)'
  ),
  optionsToLabel: (options) => options,
});
