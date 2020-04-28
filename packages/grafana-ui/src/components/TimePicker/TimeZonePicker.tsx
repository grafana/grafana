import React, { FC } from 'react';
import { getTimeZoneGroups } from '@grafana/data';
import { Cascader } from '../index';

export interface Props {
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
        value: timeZone,
      };
    });

    return {
      label: group.label,
      value: group.label,
      items: options,
    };
  });

  const selectedValue = groupOptions.reduce(
    (acc, group) => {
      const found = group.items.find(option => option.value === value);
      return found || acc;
    },
    { value: '' }
  );

  return (
    <Cascader
      options={groupOptions}
      initialValue={selectedValue?.value}
      onSelect={(newValue: string) => onChange(newValue)}
      width={width}
      placeholder="Select timezone"
    />
  );
};
