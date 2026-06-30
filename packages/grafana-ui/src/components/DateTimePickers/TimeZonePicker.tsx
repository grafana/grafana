import { useMemo, useCallback } from 'react';

import {
  type SelectableValue,
  type TimeZoneInfo,
  type GroupedTimeZones,
  type TimeZone,
  InternalTimeZones,
  getTimeZone,
  getTimeZoneAbbreviation,
  getTimeZoneOffsetMinutes,
  guessBrowserTimeZone,
  isValidTimeZone,
  listTimeZones,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { Select } from '../Select/Select';

import { TimeZoneGroup } from './TimeZonePicker/TimeZoneGroup';
import { formatUtcOffset } from './TimeZonePicker/TimeZoneOffset';
import { CompactTimeZoneOption, WideTimeZoneOption, type SelectableZone } from './TimeZonePicker/TimeZoneOption';
import { getTimeZoneTitle } from './TimeZonePicker/TimeZoneTitle';

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

/**
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/date-time-pickers-timezonepicker--docs
 */
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
    menuShouldPortal = true,
    openMenuOnFocus = false,
  } = props;
  const groupedTimeZones = useTimeZones(includeInternal);
  const selected = useSelectedTimeZone(groupedTimeZones, value);
  const filterBySearchIndex = useFilterBySearchIndex();
  const TimeZoneOption = width && width <= 45 ? CompactTimeZoneOption : WideTimeZoneOption;

  const onChangeTz = useCallback(
    (selectable: SelectableValue<string>) => {
      if (!selectable || typeof selectable.value !== 'string') {
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
      placeholder={t('time-picker.zone.select-search-input', 'Type to search (city, abbreviation, offset)')}
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

  const timeZoneGroups = useMemo(() => {
    return getTimeZoneGroups(includeInternal).map((group: GroupedTimeZones) => {
      const options = group.zones.reduce((options: SelectableZone[], zone) => {
        const info = getTimeZoneInfo(zone, now);

        if (!info) {
          return options;
        }

        const name = getTimeZoneTitle(info);

        options.push({
          label: name,
          value: info.zone,
          info,
          searchIndex: getSearchIndex(name, info, now),
        });

        return options;
      }, []);

      return {
        label: group.name,
        options,
      };
    });
  }, [includeInternal, now]);

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

    const tz = timeZone?.toLowerCase() ?? '';

    const group = groups.find((group) => {
      if (!group.label) {
        return isInternal(tz);
      }
      return tz.startsWith(group.label.toLowerCase());
    });

    return group?.options.find((option) => {
      if (tz === '') {
        return option.value === InternalTimeZones.default;
      }
      return option.value?.toLowerCase() === tz;
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
    return option.data.searchIndex.indexOf(searchQuery.toLowerCase()) > -1;
  }, []);
};

const getSearchIndex = (label: string, info: TimeZoneInfo, timestamp: number): string => {
  const parts: string[] = [
    info.zone.toLowerCase(),
    info.abbreviation.toLowerCase(),
    formatUtcOffset(timestamp, info.zone).toLowerCase(),
  ];

  if (label !== info.zone) {
    parts.push(label.toLowerCase());
  }

  return parts.join('|');
};

/**
 * Builds the grouped list of time zones from the Intl-backed catalog
 * (no moment-timezone dependency). Optional internal zones (Default, Browser,
 * UTC) are placed in a leading, label-less group so they render at the top.
 */
const getTimeZoneGroups = (includeInternal: boolean | InternalTimeZones[]): GroupedTimeZones[] => {
  const internalZones: TimeZone[] = [];

  if (includeInternal === true) {
    internalZones.push(InternalTimeZones.default, InternalTimeZones.localBrowserTime, InternalTimeZones.utc);
  } else if (Array.isArray(includeInternal)) {
    internalZones.push(...includeInternal);
  }

  const groups = new Map<string, TimeZone[]>();

  if (internalZones.length > 0) {
    groups.set('', internalZones);
  }

  for (const zone of listTimeZones()) {
    const delimiter = zone.indexOf('/');
    const group = delimiter === -1 ? '' : zone.slice(0, delimiter);

    const zones = groups.get(group) ?? [];
    zones.push(zone);
    groups.set(group, zones);
  }

  return Array.from(groups, ([name, zones]) => ({ name, zones }));
};

/**
 * Intl-backed replacement for the moment-based getTimeZoneInfo. Country data is
 * intentionally omitted; the picker no longer supports searching by country.
 */
const getTimeZoneInfo = (zone: string, timestamp: number): TimeZoneInfo | undefined => {
  switch (zone) {
    case InternalTimeZones.utc:
      return {
        name: 'Coordinated Universal Time',
        ianaName: 'UTC',
        zone,
        countries: [],
        abbreviation: 'UTC, GMT',
        offsetInMins: 0,
      };

    case InternalTimeZones.localBrowserTime: {
      const ianaName = guessBrowserTimeZone();
      return {
        name: 'Browser Time',
        ianaName,
        zone,
        countries: [],
        abbreviation: getTimeZoneAbbreviation(ianaName, timestamp),
        offsetInMins: getTimeZoneOffsetMinutes(ianaName, timestamp),
      };
    }

    case InternalTimeZones.default: {
      const resolved = getTimeZone();
      const info = resolved === InternalTimeZones.default ? undefined : getTimeZoneInfo(resolved, timestamp);

      return {
        countries: [],
        abbreviation: '',
        offsetInMins: 0,
        ianaName: '',
        ...info,
        name: 'Default',
        zone,
      };
    }

    default: {
      if (!isValidTimeZone(zone)) {
        return undefined;
      }

      return {
        name: zone,
        ianaName: zone,
        zone,
        countries: [],
        abbreviation: getTimeZoneAbbreviation(zone, timestamp),
        offsetInMins: getTimeZoneOffsetMinutes(zone, timestamp),
      };
    }
  }
};
