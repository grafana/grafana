import { memo, useCallback, useMemo } from 'react';

import { DataFrame, FieldMatcherID, fieldMatchers, FieldType } from '@grafana/data';
import { t } from '@grafana/i18n';

import { getFieldTypeIconName } from '../../types/icon';
import { Combobox } from '../Combobox/Combobox';
import { ComboboxOption } from '../Combobox/types';

import { FieldMatcherUIRegistryItem, MatcherUIProps } from './types';

export const FieldTypeMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { data, options, onChange: onChangeFromProps, id } = props;
  const counts = useFieldCounts(data);
  const selectOptions = useSelectOptions(counts, options);

  const onChange = useCallback(
    (selection: ComboboxOption) => {
      return onChangeFromProps(selection.value!);
    },
    [onChangeFromProps]
  );

  const selectedOption = selectOptions.find((v) => v.value === options);
  return <Combobox id={id} value={selectedOption} options={selectOptions} onChange={onChange} />;
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

const useFieldCounts = (data: DataFrame[]): Map<FieldType, number> => {
  return useMemo(() => {
    const counts: Map<FieldType, number> = new Map();
    for (const t of getAllFieldTypeIconOptions()) {
      counts.set(t.value!, 0);
    }
    for (const frame of data) {
      for (const field of frame.fields) {
        const key = field.type || FieldType.other;
        let v = counts.get(key);
        if (!v) {
          v = 0;
        }
        counts.set(key, v + 1);
      }
    }
    return counts;
  }, [data]);
};

const useSelectOptions = (counts: Map<string, number>, opt?: string): ComboboxOption[] => {
  return useMemo(() => {
    let found = false;
    const options: ComboboxOption[] = [];
    for (const t of getAllFieldTypeIconOptions()) {
      const count = counts.get(t.value!);
      const match = opt === t.value;
      if (count || match) {
        options.push({
          ...t,
          label: `${t.label} (${counts.get(t.value!)})`,
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
  }, [counts, opt]);
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
