import React, { useCallback, useMemo } from 'react';
import { DataFrame, SelectableValue, StandardEditorProps } from '@grafana/data';
import { Select } from '@grafana/ui';

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
  const info = useMemo(() => {
    return getLabelInfo(context.data, value);
  }, [context.data, value]);

  const onSelectChange = useCallback(
    (selection: SelectableValue<string>) => {
      return onChange(selection.value!);
    },
    [onChange]
  );

  return (
    <>
      <Select
        value={info.selected}
        options={info.options}
        onChange={onSelectChange}
        noOptionsMessage={settings.noLabelsMessage}
      />
    </>
  );
};

export function getLabelInfo(frames: DataFrame[], current?: string) {
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
          values.add(field.labels[label]);
        }
      }
    }
  }

  const showValues = 5;
  for (const option of options) {
    const allValues = info.get(option.value!)!;
    let values = [...allValues.keys()];
    if (allValues.size > showValues) {
      values = values.slice(0, showValues);
      values.push(`(${allValues.size} values)...`);
    }
    option.description = values.join(', ');
  }

  if (current && !selected) {
    selected = {
      label: `${current} (not found)`,
      value: current,
    };
    options.push(selected);
  }
  return { options, selected, info };
}
