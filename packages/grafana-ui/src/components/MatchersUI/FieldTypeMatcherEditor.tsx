import React, { memo, useMemo, useCallback } from 'react';
import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import { FieldMatcherID, fieldMatchers, SelectableValue, FieldType, DataFrame } from '@grafana/data';
import { Select } from '../Select/Select';

export const FieldTypeMatcherEditor = memo<MatcherUIProps<string>>(props => {
  const { data, options } = props;
  const counts = useFieldCounts(data);
  const selectOptions = useSelectOptions(counts);

  const onChange = useCallback(
    (selection: SelectableValue<string>) => {
      return props.onChange(selection.value!);
    },
    [counts, props.onChange]
  );

  const selectedOption = selectOptions.find(v => v.value === options);
  return <Select value={selectedOption} options={selectOptions} onChange={onChange} />;
});

const useFieldCounts = (data: DataFrame[]): Map<string, number> => {
  return useMemo(() => {
    const counts: Map<string, number> = new Map();
    counts.set(FieldType.boolean, 0);
    counts.set(FieldType.string, 0);
    counts.set(FieldType.number, 0);
    counts.set(FieldType.trace, 0);
    counts.set(FieldType.time, 0);
    counts.set(FieldType.other, 0);

    let total = 0;
    for (const frame of data) {
      for (const field of frame.fields) {
        const key = field.type || FieldType.other;
        let v = counts.get(key);
        if (!v) {
          v = 0;
        }
        counts.set(key, v + 1);
        total++;
      }
    }
    counts.set('*', total);
    return counts;
  }, [data]);
};

const allTypes: Array<SelectableValue<string>> = [
  { value: FieldType.number, label: 'Numeric fields' },
  { value: FieldType.string, label: 'String fields' },
  { value: FieldType.time, label: 'Time fields' },
  { value: '*', label: 'Any field type' },
];

// return useMemo(() => {
//   return Array.from(displayNames).map(n => ({
//     value: n,
//     label: n,
//   }));
// }, [displayNames]);

const useSelectOptions = (counts: Map<string, number>): Array<SelectableValue<string>> => {
  return useMemo(() => {
    return allTypes.map(orig => ({
      ...orig,
      label: `${orig.label} (${counts.get(orig.value!)})`,
    }));
  }, [counts]);
};

export const fieldTypeMatcherItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.byType,
  component: FieldTypeMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byType),
  name: 'Filter by type',
  description: 'Set properties for fields matching a type',
};
