import React, { useCallback } from 'react';
import { DataFrame, FieldNamePickerConfigSettings, SelectableValue, StandardEditorProps } from '@grafana/data';
import { Select } from '@grafana/ui';
import { OptionsPaneOptions } from 'app/features/dashboard/components/PanelEditor/OptionsPaneOptions';

export interface FieldLabelPickerConfigSettings {
  /**
   * Show this text when no values are found
   */
  noLabelsMessage?: string;
}

// Pick a field name out of the fulds
export const FieldLabelPicker: React.FC<StandardEditorProps<string, FieldLabelPickerConfigSettings>> = ({
  value,
  onChange,
  context,
  item,
}) => {
  const settings: FieldLabelPickerConfigSettings = item.settings ?? {};
  const names = useFieldDisplayNames(context.data, settings?.filter);
  const selectOptions = useSelectOptions(names, value);

  const onSelectChange = useCallback(
    (selection: SelectableValue<string>) => {
      if (!frameHasName(selection.value, names)) {
        return;
      }
      return onChange(selection.value!);
    },
    [names, onChange]
  );

  const selectedOption = selectOptions.find((v) => v.value === value);
  return (
    <>
      <Select
        value={selectedOption}
        options={selectOptions}
        onChange={onSelectChange}
        noOptionsMessage={settings.noFieldsMessage}
      />
    </>
  );
};

function getLabelInfo(frames: DataFrame[], current?: string) {
  const info = new Map<string, Set<string>>();
  const options: Array<SelectableValue<string>> = [];
  let selected: SelectableValue<string> | undefined = undefined;

  for (const frame of frames) {
    for (const field of frame.fields) {
      if (field.labels) {
        for (const label of Object.keys(field.labels)) {
          let values = info.get(label);
          if (!values) {
            values = new Set<string>();
            info.set(label, values);
            const item = {
              label,
              value: label,
            };
            if (label === current) {
              selected = item;
            }
            options.push(item);
          }
        }
      }
    }
  }

  const showValues = 5;
  for (const option of options) {
    const allValues = info.get(option.value!)!;
    const values = new Array(allValues).slice(0);
    option.description = values.join(', ');
    if (allValues.size > showValues) {
      option.description += `, (${allValues.size} values)...`;
    }
  }

  return { options, selected, info };
}
