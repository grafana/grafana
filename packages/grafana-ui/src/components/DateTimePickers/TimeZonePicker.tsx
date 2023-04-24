import { toLower, isEmpty, isString } from 'lodash';
import React, { useMemo, useCallback } from 'react';

import {
  SelectableValue,
  getTimeZoneInfo,
  TimeZoneInfo,
  getTimeZoneGroups,
  GroupedTimeZones,
  TimeZone,
  InternalTimeZones,
} from '@grafana/data';

import { t } from '../../utils/i18n';
import { Select } from '../Select/Select';

import { TimeZoneGroup } from './TimeZonePicker/TimeZoneGroup';
import { formatUtcOffset } from './TimeZonePicker/TimeZoneOffset';
import { CompactTimeZoneOption, WideTimeZoneOption, SelectableZone } from './TimeZonePicker/TimeZoneOption';

export interface Props {
  onChange: (timeZone?: TimeZone) => void;
  value?: TimeZone;
  width?: number;
  autoFocus?: boolean;
  onBlur?: () => void;
  includeInternal?: boolean | InternalTimeZones[];
  disabled?: boolean;
  inputId?: string;
  menuShouldPortal?: boolean;
  openMenuOnFocus?: boolean;
}

export const TimeZonePicker = (props: Props) => {
  const {
    onChange,
    width,
    autoFocus = false,
    onBlur,
    value,
    includeInternal = false,
    disabled = false,
    inputId,
    menuShouldPortal = false,
    openMenuOnFocus = true,
  } = props;
  const groupedTimeZones = useTimeZones(includeInternal);
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
      inputId={inputId}
      value={selected}
      placeholder={t('time-picker.zone.select-search-input', 'Type to search (country, city, abbreviation)')}
      autoFocus={autoFocus}
      menuShouldPortal={menuShouldPortal}
      openMenuOnFocus={openMenuOnFocus}
      width={width}
      filterOption={filterBySearchIndex}
      options={groupedTimeZones}
      onChange={onChangeTz}
      onBlur={onBlur}
      components={{ Option: TimeZoneOption, Group: TimeZoneGroup }}
      disabled={disabled}
      aria-label={t('time-picker.zone.select-aria-label', 'Time zone picker')}
    />
  );
};

interface SelectableZoneGroup extends SelectableValue<string> {
  options: SelectableZone[];
}

const useTimeZones = (includeInternal: boolean | InternalTimeZones[]): SelectableZoneGroup[] => {
  const now = Date.now();

  const timeZoneGroups = getTimeZoneGroups(includeInternal).map((group: GroupedTimeZones) => {
    const options = group.zones.reduce((options: SelectableZone[], zone) => {
      const info = getTimeZoneInfo(zone, now);

      if (!info) {
        return options;
      }

      options.push({
        label: info.name,
        value: info.zone,
        searchIndex: getSearchIndex(info, now),
      });

      return options;
    }, []);

    return {
      label: group.name,
      options,
    };
  });
  return timeZoneGroups;
};

const useSelectedTimeZone = (
  groups: SelectableZoneGroup[],
  timeZone: TimeZone | undefined
): SelectableZone | undefined => {
  return useMemo(() => {
    if (timeZone === undefined) {
      return undefined;
    }

    const tz = toLower(timeZone);

    const group = groups.find((group) => {
      if (!group.label) {
        return isInternal(tz);
      }
      return tz.startsWith(toLower(group.label));
    });

    return group?.options.find((option) => {
      if (isEmpty(tz)) {
        return option.value === InternalTimeZones.default;
      }
      return toLower(option.value) === tz;
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

const getSearchIndex = (info: TimeZoneInfo, timestamp: number): string => {
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
};
