import React, { FC } from 'react';
import { getTimezones, SelectableValue } from '@grafana/data';
import { Select } from '..';

interface Props {
  value: string;
  width?: number;

  onChange: (newValue: string) => void;
}

export const TimeZonePicker: FC<Props> = ({ onChange, value, width }) => {
  const timeZones = getTimezones();
  const optionGroups = timeZones.map(timezone => {
    return timezone.split('/');
  });
  const options = timeZones.map(timezone => {
    return { value: timezone.toLowerCase(), label: timezone };
  });

  console.log(options);

  const selectedValue = options.filter(option => option.value === value);

  return (
    <Select
      options={options}
      value={selectedValue}
      onChange={(newValue: SelectableValue) => onChange(newValue.value)}
      width={width}
    />
  );
};
