import React, { FC, useMemo } from 'react';
import { getTimeZoneGroups } from '@grafana/data';
import { Cascader } from '../index';
import { CascaderOption } from '../Cascader/Cascader';

export interface Props {
  value: string;
  width?: number;
  withInternalTimeZones?: boolean;

  onChange: (newValue: string) => void;
}

export const TimeZonePicker: FC<Props> = ({ onChange, value, width, withInternalTimeZones = false }) => {
  const groupOptions = useTimeZoneGroups(withInternalTimeZones);
  const selectedOption = useOptionFromGroups(groupOptions, value);

  return (
    <Cascader
      options={groupOptions}
      initialValue={selectedOption?.value}
      onSelect={(newValue: string) => onChange(newValue)}
      width={width}
      placeholder="Select timezone"
    />
  );
};

const internalTimeZones = [
  { value: '', label: 'Default' },
  { value: 'browser', label: 'Local browser time' },
  { value: 'utc', label: 'UTC' },
];

const useOptionFromGroups = (groupOptions: CascaderOption[], value: string): CascaderOption | undefined => {
  return useMemo(() => {
    return groupOptions.find(group => {
      if (!Array.isArray(group.items)) {
        return group.value === value;
      }
      return group.items.find(item => item.value === value);
    });
  }, [groupOptions, value]);
};

const useTimeZoneGroups = (withInternalTimeZones = false): CascaderOption[] => {
  return useMemo(() => {
    const timeZoneGroups: CascaderOption[] = [];

    if (withInternalTimeZones) {
      timeZoneGroups.push.apply(timeZoneGroups, internalTimeZones);
    }

    return getTimeZoneGroups().reduce((groups, group) => {
      const options = group.options.map(timeZone => {
        return {
          label: timeZone,
          value: timeZone,
        };
      });

      groups.push({
        label: group.label,
        value: group.label,
        items: options,
      });

      return groups;
    }, timeZoneGroups);
  }, [withInternalTimeZones]);
};
