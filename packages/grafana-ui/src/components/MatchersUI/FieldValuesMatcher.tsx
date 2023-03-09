import React, { memo, useMemo, useCallback } from 'react';

import { FieldMatcherID, fieldMatchers, SelectableValue, fieldReducers } from '@grafana/data';

import { Select } from '../Select/Select';

import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';

export const FieldValuesMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { data, options, onChange: onChangeFromProps, id } = props;

  const selectOptions = useMemo(() => {
    const options: Array<SelectableValue<string>> = [];

    for (const info of fieldReducers.list()) {
      options.push({
        value: info.id,
        label: info.name,
      });
    }

    return options;
  }, []);

  const onChange = useCallback(
    (selection: SelectableValue<string>) => {
      return onChangeFromProps(selection.value!);
    },
    [onChangeFromProps]
  );

  const selectedOption = selectOptions.find((v) => v.value === options);
  return <Select inputId={id} value={selectedOption} options={selectOptions} onChange={onChange} />;
});
FieldValuesMatcherEditor.displayName = 'FieldValuesMatcherEditor';

export const fieldValuesMatcherItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.byValues,
  component: FieldValuesMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byValues),
  name: 'Fields with values',
  description: 'Set properties for fields with reducer condition',
  optionsToLabel: (options) => options,
};
