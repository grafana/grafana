import { useMemo, useCallback } from 'react';

import { type SelectableValue, type TimeZoneInfo, type TimeZone, InternalTimeZones } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Select } from '../Select/Select';

import { getTimeZonesAt, type TimeZoneInfo as EasyTzInfo } from './TimeZonePicker/easytz';
import { TimeZoneGroup } from './TimeZonePicker/TimeZoneGroup';
import { formatUtcOffset } from './TimeZonePicker/TimeZoneOffset';
import { CompactTimeZoneOption, WideTimeZoneOption, type SelectableZone } from './TimeZonePicker/TimeZoneOption';
import { getTimeZoneTitle } from './TimeZonePicker/TimeZoneTitle';
import { findTimeZoneAt, offsetToMinutes, resolveIanaName } from './TimeZonePicker/timeZoneUtils';

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
    const groups = new Map<string, SelectableZone[]>();

    const pushOption = (group: string, info: TimeZoneInfo, aliasOf?: string) => {
      const name = getTimeZoneTitle(info);
      const options = groups.get(group) ?? [];

      options.push({
        label: name,
        value: info.zone,
        info,
        searchIndex: getSearchIndex(name, info, now, aliasOf),
      });

      groups.set(group, options);
    };

    // Internal zones (Default, Browser, UTC) go into a leading, label-less
    // group so they render at the top of the menu.
    const internalZones: TimeZone[] = [];

    if (includeInternal === true) {
      internalZones.push(InternalTimeZones.default, InternalTimeZones.localBrowserTime, InternalTimeZones.utc);
    } else if (Array.isArray(includeInternal)) {
      internalZones.push(...includeInternal);
    }

    for (const zone of internalZones) {
      pushOption('', getInternalTimeZoneInfo(zone, now));
    }

    for (const tz of getTimeZonesAt(now)) {
      const delimiter = tz.name.indexOf('/');
      const group = delimiter === -1 ? '' : tz.name.slice(0, delimiter);
      pushOption(group, toTimeZoneInfo(tz), tz.aliasOf);
    }

    return Array.from(groups, ([label, options]) => ({ label, options }));
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

const getSearchIndex = (label: string, info: TimeZoneInfo, timestamp: number, aliasOf?: string): string => {
  const parts: string[] = [
    info.zone.toLowerCase(),
    info.abbreviation.toLowerCase(),
    formatUtcOffset(timestamp, info.zone).toLowerCase(),
  ];

  if (label !== info.zone) {
    parts.push(label.toLowerCase());
  }

  // Make the zone findable under its alternate spelling too
  // (e.g. Asia/Calcutta is also searchable as "kolkata").
  if (aliasOf) {
    parts.push(aliasOf.toLowerCase());
  }

  return parts.join('|');
};

/**
 * Maps an easy-tz catalog entry to Grafana's TimeZoneInfo shape. Country data
 * is intentionally omitted; the picker no longer supports searching by country.
 */
const toTimeZoneInfo = (tz: EasyTzInfo): TimeZoneInfo => ({
  name: tz.name,
  ianaName: tz.name,
  zone: tz.name,
  countries: [],
  abbreviation: tz.abbr,
  offsetInMins: offsetToMinutes(tz.offset),
});

/** Builds display info for Grafana's internal zones (Default, Browser, UTC). */
const getInternalTimeZoneInfo = (zone: TimeZone, timestamp: number): TimeZoneInfo => {
  if (zone === InternalTimeZones.utc) {
    return {
      name: 'Coordinated Universal Time',
      ianaName: 'UTC',
      zone,
      countries: [],
      abbreviation: 'UTC, GMT',
      offsetInMins: 0,
    };
  }

  const name = zone === InternalTimeZones.localBrowserTime ? 'Browser Time' : 'Default';
  const ianaName = resolveIanaName(zone);
  const tz = findTimeZoneAt(ianaName, timestamp);

  return {
    name,
    ianaName,
    zone,
    countries: [],
    abbreviation: tz?.abbr ?? '',
    offsetInMins: tz ? offsetToMinutes(tz.offset) : 0,
  };
};
