import React, { FC } from 'react';
import { getTimeZoneGroups, SelectableValue } from '@grafana/data';
import { Forms } from '../index';
import { FormInputSize } from '../Forms/types';

interface Props {
  value: string;
  size?: FormInputSize;

  onChange: (newValue: string) => void;
}

export const TimeZonePicker: FC<Props> = ({ onChange, value, size }) => {
  const timeZoneGroups = getTimeZoneGroups();

  const groupOptions = timeZoneGroups.map(group => {
    const options = group.options.map(timeZone => {
      return {
        label: timeZone,
        value: timeZone,
      };
    });

    return {
      label: group.label,
      options,
    };
  });

  const selectedValue = groupOptions.map(group => {
    return group.options.find(option => option.value === value);
  });

  return (
    <Forms.Select
      options={groupOptions}
      value={selectedValue}
      onChange={(newValue: SelectableValue) => onChange(newValue.value)}
      size={size}
      placeholder="Select timezone"
    />
  );
};
