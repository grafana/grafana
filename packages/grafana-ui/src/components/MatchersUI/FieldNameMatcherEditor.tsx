import React, { memo, useMemo, useCallback } from 'react';
import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import { FieldMatcherID, fieldMatchers, getFieldDisplayName, SelectableValue, DataFrame } from '@grafana/data';
import { Select } from '../Select/Select';

export const FieldNameMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { data, options, onChange: onChangeFromProps } = props;
  const names = useFieldDisplayNames(data);
  const selectOptions = useSelectOptions(names);

  const onChange = useCallback(
    (selection: SelectableValue<string>) => {
      if (!selection.value || !names.has(selection.value)) {
        return;
      }
      return onChangeFromProps(selection.value);
    },
    [names, onChangeFromProps]
  );

  const selectedOption = selectOptions.find((v) => v.value === options);
  return <Select value={selectedOption} options={selectOptions} onChange={onChange} />;
});
FieldNameMatcherEditor.displayName = 'FieldNameMatcherEditor';

export const fieldNameMatcherItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.byName,
  component: FieldNameMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byName),
  name: 'Fields with name',
  description: 'Set properties for a specific field',
  optionsToLabel: (options) => options,
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
    return Array.from(displayNames).map((n) => ({
      value: n,
      label: n,
    }));
  }, [displayNames]);
};
