import { memo, useCallback } from 'react';

import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Combobox } from '../Combobox/Combobox';
import { ComboboxOption } from '../Combobox/types';

import { FieldMatcherUIRegistryItem, MatcherUIProps } from './types';
import { frameHasName, useFieldDisplayNames, useSelectOptions } from './utils';

export const FieldNameMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { data, options, onChange: onChangeFromProps, id } = props;
  const names = useFieldDisplayNames(data);
  const selectOptions: ComboboxOption[] = useSelectOptions(names, options);

  const onChange = useCallback(
    (selection: ComboboxOption) => {
      if (!frameHasName(selection.value, names)) {
        return;
      }
      return onChangeFromProps(selection.value!);
    },
    [names, onChangeFromProps]
  );

  const selectedOption = selectOptions.find((v) => v.value === options);
  return (
    <Combobox
      value={selectedOption}
      options={selectOptions}
      onChange={onChange}
      placeholder={t('grafana-ui.select.placeholder', 'Choose')}
      id={id}
    />
  );
});
FieldNameMatcherEditor.displayName = 'FieldNameMatcherEditor';

export const getFieldNameMatcherItem: () => FieldMatcherUIRegistryItem<string> = () => ({
  id: FieldMatcherID.byName,
  component: FieldNameMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byName),
  name: t('grafana-ui.matchers-ui.name-fields-with-name', 'Fields with name'),
  description: t('grafana-ui.matchers-ui.description-fields-with-name', 'Set properties for a specific field'),
  optionsToLabel: (options) => options,
});
