import React, { memo, useMemo, useCallback } from 'react';
import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import {
  FieldMatcherID,
  fieldMatchers,
  getFieldDisplayName,
  FieldNameMatcherOptions,
  SelectableValue,
  DataFrame,
} from '@grafana/data';
import { Select } from '../Select/Select';

export const FieldNameMatcherEditor = memo<MatcherUIProps<FieldNameMatcherOptions>>(props => {
  const { data, options } = props;
  const names = useFieldDisplayNames(data);
  const selectOptions = useSelectOptions(names);

  const onChange = useCallback(
    (selection: SelectableValue<string>) => {
      if (!selection.value || !names.has(selection.value)) {
        return;
      }
      return props.onChange({ names: [selection.value] });
    },
    [names]
  );

  const value = getValueFromOptions(options);
  const selectedOption = selectOptions.find(v => v.value === value);

  return <Select value={selectedOption} options={selectOptions} onChange={onChange} />;
});

export const fieldNameMatcherItem: FieldMatcherUIRegistryItem<FieldNameMatcherOptions> = {
  id: FieldMatcherID.byName,
  component: FieldNameMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byName),
  name: 'Filter by field',
  description: 'Set properties for fields matching the name',
};

const useFieldDisplayNames = (data: DataFrame[]): Set<string> => {
  return useMemo(() => {
    const names: Set<string> = new Set();

    for (const frame of data) {
      for (const field of frame.fields) {
        names.add(getFieldDisplayName(field, frame, data));
      }
    }

    return names;
  }, [data]);
};

const useSelectOptions = (displayNames: Set<string>): Array<SelectableValue<string>> => {
  return useMemo(() => {
    return Array.from(displayNames).map(n => ({
      value: n,
      label: n,
    }));
  }, [displayNames]);
};

const getValueFromOptions = (options: FieldNameMatcherOptions): string | undefined => {
  if (!Array.isArray(options?.names) || options?.names.length !== 1) {
    return undefined;
  }
  return options.names[0];
};
