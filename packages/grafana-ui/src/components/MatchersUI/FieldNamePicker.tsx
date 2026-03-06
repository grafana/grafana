import { FieldNamePickerConfigSettings, StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Combobox, ComboboxProps } from '../Combobox/Combobox';

import { useFieldDisplayNames, useSelectOptions, frameHasName } from './utils';

type Props = StandardEditorProps<string, FieldNamePickerConfigSettings>;

// Pick a field name out of the fields
export const FieldNamePicker = ({ value, onChange, context, item, id }: Props) => {
  const settings: FieldNamePickerConfigSettings = item.settings ?? {};
  const names = useFieldDisplayNames(context.data, settings?.filter);
  const selectOptions = useSelectOptions(names, value, undefined, undefined, settings.baseNameMode);

  const selectedOption = selectOptions.find((v) => v.value === value);
  const isClearable = settings.isClearable !== false;

  const commonProps = {
    id,
    value: selectedOption,
    placeholder: settings.placeholderText ?? t('grafana-ui.matchers-ui.field-name-picker.placeholder', 'Select field'),
    options: selectOptions,
    noOptionsMessage: settings.noFieldsMessage,
    width: settings.width,
  } satisfies Partial<ComboboxProps<string>>;

  return isClearable ? (
    <Combobox<string>
      {...commonProps}
      isClearable={true}
      onChange={(opt) => {
        if (opt != null && !frameHasName(opt.value, names)) {
          return;
        }
        onChange(opt?.value);
      }}
    />
  ) : (
    <Combobox<string>
      {...commonProps}
      isClearable={false}
      onChange={(opt) => {
        if (!frameHasName(opt.value, names)) {
          return;
        }
        onChange(opt.value);
      }}
    />
  );
};
