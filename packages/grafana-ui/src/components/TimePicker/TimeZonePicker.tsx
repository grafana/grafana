import React, { FC } from 'react';
import { getTimeZoneGroups } from '@grafana/data';
import { Cascader } from '../index';
import { FormInputSize } from '../Forms/types';

interface Props {
  value: string;
  size?: FormInputSize;

  onChange: (newValue: string) => void;
}

export const TimeZonePicker: FC<Props> = ({ onChange, value, size = 'md' }) => {
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
      size={size}
      placeholder="Select timezone"
    />
  );
};
