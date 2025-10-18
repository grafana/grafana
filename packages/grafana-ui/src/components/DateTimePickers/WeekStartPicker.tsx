import { useCallback, useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { Combobox } from '../Combobox/Combobox';
import { ComboboxOption } from '../Combobox/types';

export interface Props {
  onChange: (weekStart?: WeekStart) => void;
  value?: WeekStart;
  width?: number;
  autoFocus?: boolean;
  onBlur?: () => void;
  disabled?: boolean;
  inputId?: string;
}

export type WeekStart = 'saturday' | 'sunday' | 'monday';

export function isWeekStart(value: string): value is WeekStart {
  return ['saturday', 'sunday', 'monday'].includes(value);
}

/**
 * Returns the system or user defined week start (as defined in bootData)
 * Or you can pass in an override weekStart string and have it be validated and returned as WeekStart type if valid
 */
export function getWeekStart(override?: string): WeekStart {
  if (override && isWeekStart(override)) {
    return override;
  }

  const preference = window?.grafanaBootData?.user?.weekStart;
  if (preference && isWeekStart(preference)) {
    return preference;
  }

  return 'monday';
}

export const WeekStartPicker = (props: Props) => {
  const { onChange, width, autoFocus = false, onBlur, value, disabled = false, inputId } = props;
  const weekStarts: ComboboxOption[] = useMemo(
    () => [
      { value: '', label: t('grafana-ui.week-start-picker.weekStarts-label-default', 'Default') },
      { value: 'saturday', label: t('grafana-ui.week-start-picker.weekStarts-label-saturday', 'Saturday') },
      { value: 'sunday', label: t('grafana-ui.week-start-picker.weekStarts-label-sunday', 'Sunday') },
      { value: 'monday', label: t('grafana-ui.week-start-picker.weekStarts-label-monday', 'Monday') },
    ],
    []
  );

  const onChangeWeekStart = useCallback(
    (selectable: ComboboxOption | null) => {
      if (selectable && selectable.value !== undefined) {
        onChange(isWeekStart(selectable.value) ? selectable.value : undefined);
      }
    },
    [onChange]
  );

  const selected = useMemo(() => weekStarts.find((item) => item.value === value)?.value ?? '', [value, weekStarts]);

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
