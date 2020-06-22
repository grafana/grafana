import React, { useMemo, useCallback } from 'react';
import { toLower } from 'lodash';
import {
  SelectableValue,
  getTimeZoneInfo,
  TimeZoneInfo,
  getTimeZoneGroups,
  GroupedTimeZones,
  TimeZone,
} from '@grafana/data';
import { Select } from '../Select/Select';
import { TimeZoneOption, SelectableZone } from './TimeZoneOption';
import { TimeZoneGroup } from './TimeZoneGroup';
import { formatUtcOffset } from './TimeZoneOffset';

export interface Props {
  value: TimeZone;
  width?: number;
  onChange: (newValue: string) => void;
}

export const TimeZonePicker: React.FC<Props> = ({ onChange, value, width }) => {
  const groupedTimeZones = useTimeZones();
  const filterBySearchIndex = useFilterBySearchIndex();

  return (
    <Select
      width={width}
      filterOption={filterBySearchIndex}
      options={groupedTimeZones}
      onChange={() => {}}
      components={{ Option: TimeZoneOption, Group: TimeZoneGroup }}
    />
  );
};

interface SelectableZoneGroup extends SelectableValue<string> {
  options: SelectableZone[];
}

const useTimeZones = (): SelectableZoneGroup[] => {
  const now = Date.now();

  return getTimeZoneGroups(true).map((group: GroupedTimeZones) => {
    const options = group.zones.reduce((options: SelectableZone[], zone) => {
      const info = getTimeZoneInfo(zone, now);

      if (!info) {
        return options;
      }

      options.push({
        label: info.name,
        value: info.zone,
        searchIndex: useSearchIndex(info, now),
      });

      return options;
    }, []);

    return {
      label: group.name,
      options,
    };
  });
};

const useFilterBySearchIndex = () => {
  return useCallback((option: SelectableValue, searchQuery: string) => {
    if (!searchQuery || !option.data || !option.data.searchIndex) {
      return true;
    }
    return option.data.searchIndex.indexOf(toLower(searchQuery)) > -1;
  }, []);
};

const useSearchIndex = (info: TimeZoneInfo, timestamp: number): string => {
  return useMemo(() => {
    const utcOffset = formatUtcOffset(timestamp, info.zone);
    const parts: string[] = [toLower(info.zone), toLower(info.abbreviation), utcOffset];

    for (const country of info.countries) {
      parts.push(toLower(country.name));
      parts.push(toLower(country.code));
    }

    return parts.join('|');
  }, [info.zone, info.abbreviation, info.offsetInMins]);
};
