import React, { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { periodOption } from '../constants';

export interface Props {
  inputId: string;
  onChange: (period: string) => void;
  templateVariableOptions: Array<SelectableValue<string>>;
  aligmentPeriods: periodOption[];
  selectWidth?: number;
  category?: string;
  disabled?: boolean;
  current?: string;
}

export function PeriodSelect({
  inputId,
  templateVariableOptions,
  onChange,
  current,
  disabled,
  aligmentPeriods,
}: Props) {
  const options = useMemo(
    () =>
      aligmentPeriods.map((ap) => ({
        ...ap,
        label: ap.text,
      })),
    [aligmentPeriods]
  );
  const visibleOptions = useMemo(() => options.filter((ap) => !ap.hidden), [options]);

  return (
    <Select
      width="auto"
      onChange={({ value }) => onChange(value!)}
      value={[...options, ...templateVariableOptions].find((s) => s.value === current)}
      options={[
        {
          label: 'Template Variables',
          options: templateVariableOptions,
        },
        {
          label: 'Aggregations',
          expanded: true,
          options: visibleOptions,
        },
      ]}
      placeholder="Select Period"
      inputId={inputId}
      disabled={disabled}
      allowCustomValue
      menuPlacement="top"
    />
  );
}
