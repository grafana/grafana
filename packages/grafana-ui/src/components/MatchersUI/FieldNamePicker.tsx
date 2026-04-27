import { useCallback } from 'react';

import type { FieldNamePickerConfigSettings, StandardEditorProps } from '@grafana/data/field';
import type { SelectableValue } from '@grafana/data/types';
import { t } from '@grafana/i18n';

import { Combobox } from '../Combobox/Combobox';

import { useFieldDisplayNames, useMatcherSelectOptions, frameHasName } from './utils';

type Props = StandardEditorProps<string, FieldNamePickerConfigSettings>;

// Pick a field name out of the fields
export const FieldNamePicker = ({ value, onChange, context, item, id }: Props) => {
  const settings: FieldNamePickerConfigSettings = item.settings ?? {};
  const names = useFieldDisplayNames(context.data, settings?.filter);
  const selectOptions = useMatcherSelectOptions(names, value, { baseNameMode: settings.baseNameMode });

  const selectedOption = selectOptions.find((v) => v.value === value);

  const onChangeOption = useCallback(
    (opt: SelectableValue<string> | null) => {
      if (opt != null && !frameHasName(opt.value, names)) {
        return;
      }
      onChange(opt?.value);
    },
    [names, onChange]
  );

  return (
    <Combobox
      id={id}
      value={selectedOption}
      options={selectOptions}
      onChange={onChangeOption}
      placeholder={
        settings.placeholderText ?? t('grafana-ui.matchers-ui.field-name-picker.placeholder', 'Select field')
      }
      noOptionsMessage={settings.noFieldsMessage}
      width={settings.width}
      isClearable={settings.isClearable}
    />
  );
};
