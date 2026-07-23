import { memo } from 'react';

import { getValueFormats, type SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { Cascader, type CascaderOption } from '../Cascader/Cascader';

export interface UnitPickerProps {
  onChange: (item?: string) => void;
  value?: string;
  width?: number | 'auto';
  minWidth?: string;
  placeholder?: string;
  id?: string;
}

function formatCreateLabel(input: string) {
  return `Custom unit: ${input}`;
}

/**
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/pickers-unitpicker--docs
 */
export const UnitPicker = memo<UnitPickerProps>(({ onChange, value, width, minWidth, placeholder, id }) => {
  // Set the current selection
  let current: SelectableValue<string> | undefined = undefined;

  // All units
  const unitGroups = getValueFormats();

  // Need to transform the data structure to work well with Select
  const groupOptions: CascaderOption[] = unitGroups.map((group) => {
    const options = group.submenu.map((unit) => {
      const sel = {
        label: unit.text,
        value: unit.value,
      };
      if (unit.value === value) {
        current = sel;
      }
      return sel;
    });

    return {
      label: group.text,
      value: group.text,
      items: options,
    };
  });

  // Show the custom unit
  if (value && !current) {
    current = { value, label: value };
  }

  // Auto-size to the displayed label when no explicit width given.
  // Label chars * ~0.875 (7px/8px spacing unit) + 4 units for padding/clear button, min 14.
  const placeholderLen = placeholder?.length ?? 4;
  const effectiveWidth = width ?? Math.max(14, Math.ceil((current?.label?.length ?? placeholderLen) * 0.875) + 4);

  return (
    <Cascader
      id={id}
      width={effectiveWidth}
      minWidth={minWidth}
      initialValue={current && current.label}
      allowCustomValue
      changeOnSelect={false}
      formatCreateLabel={formatCreateLabel}
      options={groupOptions}
      placeholder={placeholder ?? t('grafana-ui.unit-picker.placeholder', 'Choose')}
      isClearable
      onSelect={onChange}
      data-testid={selectors.components.UnitPicker.container}
    />
  );
});

UnitPicker.displayName = 'UnitPicker';
