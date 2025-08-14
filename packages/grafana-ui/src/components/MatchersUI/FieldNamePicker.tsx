import { useCallback } from 'react';

import { FieldNamePickerConfigSettings, SelectableValue, StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Select } from '../Select/Select';

import { useFieldDisplayNames, useSelectOptions, frameHasName } from './utils';

type Props = StandardEditorProps<string, FieldNamePickerConfigSettings>;

// Pick a field name out of the fields
export const FieldNamePicker = ({ value, onChange, context, item, id }: Props) => {
  const settings: FieldNamePickerConfigSettings = item.settings ?? {};
  const names = useFieldDisplayNames(context.data, settings?.filter);
  const selectOptions = useSelectOptions(names, value, undefined, undefined, settings.baseNameMode);

  const onSelectChange = useCallback(
    (selection?: SelectableValue<string>) => {
      if (selection && !frameHasName(selection.value, names)) {
        return; // can not select name that does not exist?
      }
      return onChange(selection?.value);
    },
    [names, onChange]
  );

  const selectedOption = selectOptions.find((v) => v.value === value);
  return (
    <>
      <Select
        inputId={id}
        value={selectedOption}
        placeholder={
          settings.placeholderText ?? t('grafana-ui.matchers-ui.field-name-picker.placeholder', 'Select field')
        }
        options={selectOptions}
        onChange={onSelectChange}
        noOptionsMessage={settings.noFieldsMessage}
        width={settings.width}
        isClearable={settings.isClearable !== false}
      />
    </>
  );
};
