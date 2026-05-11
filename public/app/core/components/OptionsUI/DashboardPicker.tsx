import { useCallback } from 'react';

import { type StandardEditorProps } from '@grafana/data';
import { DashboardPicker as BasePicker, type DashboardPickerDTO } from 'app/core/components/Select/DashboardPicker';

export interface DashboardPickerOptions {
  placeholder?: string;
  isClearable?: boolean;
}

type Props = StandardEditorProps<string, DashboardPickerOptions>;

/** This will return the item UID */
export const DashboardPicker = ({ value, onChange, item }: Props) => {
  const { placeholder, isClearable } = item?.settings ?? {};

  const onPicked = useCallback(
    (sel?: DashboardPickerDTO) => {
      onChange(sel?.uid);
    },
    [onChange]
  );

  return (
    <BasePicker isClearable={isClearable} defaultOptions onChange={onPicked} placeholder={placeholder} value={value} />
  );
};
