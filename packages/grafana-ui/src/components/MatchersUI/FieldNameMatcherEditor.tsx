import { memo, useCallback } from 'react';

import { FieldMatcherID, fieldMatchers } from '@grafana/data';

import { Combobox } from '../Combobox/Combobox';
import { ComboboxOption } from '../Combobox/types';

import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import { useFieldDisplayNames, useSelectOptions, frameHasName } from './utils';

export const FieldNameMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { data, options, onChange: onChangeFromProps, id } = props;
  const names = useFieldDisplayNames(data);
  const selectOptions: Array<ComboboxOption<string>> = useSelectOptions(names, options).map((option) => ({
    ...option,
    value: option.value || '',
  }));

  const onChange = useCallback(
    (selection: ComboboxOption<string>) => {
      if (!frameHasName(selection.value, names)) {
        return;
      }
      return onChangeFromProps(selection.value!);
    },
    [names, onChangeFromProps]
  );

  const selectedOption = selectOptions.find((v) => v.value === options);
  return <Combobox value={selectedOption?.value} options={selectOptions} onChange={onChange} id={id} />;
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
