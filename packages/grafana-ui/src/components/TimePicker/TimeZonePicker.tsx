import React, { FC } from 'react';
import { getTimeZoneGroups, SelectableValue } from '@grafana/data';
import { Select } from '..';

interface Props {
  value: string;
  width?: number;

  onChange: (newValue: string) => void;
}

export const TimeZonePicker: FC<Props> = ({ onChange, value, width }) => {
  const timeZoneGroups = getTimeZoneGroups();

  const groupOptions = timeZoneGroups.map(group => {
    const options = group.options.map(timeZone => {
      return {
        label: timeZone,
        value: timeZone.toLowerCase(),
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
    <Select
      options={groupOptions}
      value={selectedValue}
      onChange={(newValue: SelectableValue) => onChange(newValue.value)}
      width={width}
    />
  );
};
