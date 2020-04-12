import React, { FC } from 'react';
import { getTimeZoneGroups } from '@grafana/data';
import { Cascader } from '../index';
import { FormInputSize } from '../Forms/types';

interface Props {
  value: string;
  size?: FormInputSize;
  includeDefault?: boolean;

  onChange: (newValue: string) => void;
}

export const TimeZonePicker: FC<Props> = ({ onChange, value, includeDefault, size = 'md' }) => {
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

  if (includeDefault) {
    groupOptions.push({
      label: 'XXXX',
      value: (undefined as unknown) as string, // typings are not happy about this
      items: [], // no
    });
  }

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
