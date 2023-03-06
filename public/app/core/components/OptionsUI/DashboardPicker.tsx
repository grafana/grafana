import React, { useCallback } from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { DashboardPicker as BasePicker, DashboardPickerDTO } from 'app/core/components/Select/DashboardPicker';

export interface DashboardPickerOptions {
  placeholder?: string;
  isClearable?: boolean;
}

type Props = StandardEditorProps<string, DashboardPickerOptions>;

/** This will return the item UID */
export const DashboardPicker = ({ value, onChange, item }: Props) => {
  const { placeholder, isClearable } = item?.settings ?? {};

  const onPicked = useCallback(
    (sel?: SelectableValue<DashboardPickerDTO>) => {
      onChange(sel?.value?.uid);
    },
    [onChange]
  );

  return (
    <BasePicker isClearable={isClearable} defaultOptions onChange={onPicked} placeholder={placeholder} value={value} />
  );
};
