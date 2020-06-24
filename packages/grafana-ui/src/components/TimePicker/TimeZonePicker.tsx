import React, { useMemo, useCallback } from 'react';
import { toLower, isEmpty, isString } from 'lodash';
import {
  SelectableValue,
  getTimeZoneInfo,
  TimeZoneInfo,
  getTimeZoneGroups,
  GroupedTimeZones,
  TimeZone,
  InternalTimeZones,
} from '@grafana/data';
import { Select } from '../Select/Select';
import { CompactTimeZoneOption, WideTimeZoneOption, SelectableZone } from './TimeZonePicker/TimeZoneOption';
import { TimeZoneGroup } from './TimeZonePicker/TimeZoneGroup';
import { formatUtcOffset } from './TimeZonePicker/TimeZoneOffset';

export interface Props {
  value?: TimeZone;
  width?: number;
  autoFocus?: boolean;
  onChange: (timeZone: TimeZone | undefined) => void;
  onBlur?: () => void;
}

export const TimeZonePicker: React.FC<Props> = props => {
  const { onChange, width, autoFocus = false, onBlur, value } = props;
  const groupedTimeZones = useTimeZones();
  const selected = useSelectedTimeZone(groupedTimeZones, value);
  const filterBySearchIndex = useFilterBySearchIndex();
  const TimeZoneOption = width && width <= 45 ? CompactTimeZoneOption : WideTimeZoneOption;

  const onChangeTz = useCallback(
    (selectable: SelectableValue<string>) => {
      if (!selectable || !isString(selectable.value)) {
        return onChange(value);
      }
      onChange(selectable.value);
    },
    [onChange, value]
  );

  return (
    <Select
      value={selected}
      placeholder="Type to search (country, city, abbreviation)"
      autoFocus={autoFocus}
      openMenuOnFocus={true}
      width={width}
      filterOption={filterBySearchIndex}
      options={groupedTimeZones}
      onChange={onChangeTz}
      onBlur={onBlur}
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

const useSelectedTimeZone = (
  groups: SelectableZoneGroup[],
  timeZone: TimeZone | undefined
): SelectableZone | undefined => {
  return useMemo(() => {
    if (timeZone === undefined) {
      return undefined;
    }

    const group = groups.find(group => {
      if (!group.label) {
        return isInternal(timeZone);
      }
      return timeZone.startsWith(group.label);
    });

    return group?.options.find(option => {
      if (isEmpty(timeZone)) {
        return option.value === InternalTimeZones.default;
      }
      return toLower(option.value) === timeZone;
    });
  }, [groups, timeZone]);
};

const isInternal = (timeZone: TimeZone): boolean => {
  switch (timeZone) {
    case InternalTimeZones.default:
    case InternalTimeZones.localBrowserTime:
    case InternalTimeZones.utc:
      return true;

    default:
      return false;
  }
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
    const parts: string[] = [
      toLower(info.name),
      toLower(info.abbreviation),
      toLower(formatUtcOffset(timestamp, info.zone)),
    ];

    for (const country of info.countries) {
      parts.push(toLower(country.name));
      parts.push(toLower(country.code));
    }

    return parts.join('|');
  }, [info.zone, info.abbreviation, info.offsetInMins]);
};
