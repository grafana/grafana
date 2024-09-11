import { useCallback, useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { Combobox, ComboboxOption } from '../Combobox/Combobox';

export interface Props {
  onChange: (weekStart: string) => void;
  value: string;
  width?: number;
  autoFocus?: boolean;
  onBlur?: () => void;
  disabled?: boolean;
  inputId?: string;
}

export type WeekStart = 'saturday' | 'sunday' | 'monday';
const weekStarts: ComboboxOption[] = [
  { value: '', label: 'Default' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
];

const isWeekStart = (value: string): value is WeekStart => {
  return ['saturday', 'sunday', 'monday'].includes(value);
};

export const getWeekStart = (value: string): WeekStart => {
  if (isWeekStart(value)) {
    return value;
  }

  return 'monday';
};

export const WeekStartPicker = (props: Props) => {
  const { onChange, width, autoFocus = false, onBlur, value, disabled = false, inputId } = props;

  const onChangeWeekStart = useCallback(
    (selectable: ComboboxOption | null) => {
      if (selectable && selectable.value !== undefined) {
        onChange(selectable.value);
      }
    },
    [onChange]
  );

  const selected = useMemo(() => weekStarts.find((item) => item.value === value)?.value ?? null, [value]);

  return (
    <Combobox
      id={inputId}
      value={selected}
      placeholder={selectors.components.WeekStartPicker.placeholder}
      autoFocus={autoFocus}
      width={width}
      options={weekStarts}
      onChange={onChangeWeekStart}
      onBlur={onBlur}
      disabled={disabled}
    />
  );
};
