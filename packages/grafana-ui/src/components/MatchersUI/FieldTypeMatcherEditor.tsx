import React, { memo, useMemo, useCallback } from 'react';

import { FieldMatcherID, fieldMatchers, SelectableValue, FieldType, DataFrame } from '@grafana/data';

import { getFieldTypeIconName } from '../../types/icon';
import { Select } from '../Select/Select';

import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';

export const FieldTypeMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { data, options, onChange: onChangeFromProps, id } = props;
  const counts = useFieldCounts(data);
  const selectOptions = useSelectOptions(counts, options);

  const onChange = useCallback(
    (selection: SelectableValue<string>) => {
      return onChangeFromProps(selection.value!);
    },
    [onChangeFromProps]
  );

  const selectedOption = selectOptions.find((v) => v.value === options);
  return <Select inputId={id} value={selectedOption} options={selectOptions} onChange={onChange} />;
});
FieldTypeMatcherEditor.displayName = 'FieldTypeMatcherEditor';

// Select options for all field types.
// This is not eported to the published package, but used internally
export const allFieldTypeIconOptions: Array<SelectableValue<FieldType>> = [
  { value: FieldType.number, label: 'Number', icon: getFieldTypeIconName(FieldType.number) },
  { value: FieldType.string, label: 'String', icon: getFieldTypeIconName(FieldType.string) },
  { value: FieldType.time, label: 'Time', icon: getFieldTypeIconName(FieldType.time) },
  { value: FieldType.boolean, label: 'Boolean', icon: getFieldTypeIconName(FieldType.boolean) },
  { value: FieldType.trace, label: 'Traces', icon: getFieldTypeIconName(FieldType.trace) },
  { value: FieldType.enum, label: 'Enum', icon: getFieldTypeIconName(FieldType.enum) },
  { value: FieldType.other, label: 'Other', icon: getFieldTypeIconName(FieldType.other) },
];

const useFieldCounts = (data: DataFrame[]): Map<FieldType, number> => {
  return useMemo(() => {
    const counts: Map<FieldType, number> = new Map();
    for (const t of allFieldTypeIconOptions) {
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

const useSelectOptions = (counts: Map<string, number>, opt?: string): Array<SelectableValue<string>> => {
  return useMemo(() => {
    let found = false;
    const options: Array<SelectableValue<string>> = [];
    for (const t of allFieldTypeIconOptions) {
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

export const fieldTypeMatcherItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.byType,
  component: FieldTypeMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byType),
  name: 'Fields with type',
  description: 'Set properties for fields of a specific type (number, string, boolean)',
  optionsToLabel: (options) => options,
};
