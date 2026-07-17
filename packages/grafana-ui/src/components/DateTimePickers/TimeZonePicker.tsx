import { useMemo, useCallback } from 'react';

import { type SelectableValue, type TimeZone, InternalTimeZones } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Select } from '../Select/Select';

import { TimeZoneGroup } from './TimeZonePicker/TimeZoneGroup';
import {
  CompactTimeZoneOption,
  WideTimeZoneOption,
  type SelectableZone,
  type TimeZoneOptionInfo,
} from './TimeZonePicker/TimeZoneOption';
import { getTimeZoneTitle } from './TimeZonePicker/TimeZoneTitle';
import {
  canonicalZoneName,
  findTimeZoneAt,
  getCanonicalTimeZonesAt,
  resolveIanaName,
} from './TimeZonePicker/timeZoneUtils';

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
      placeholder={t('time-picker.zone.select-search-input', 'Type to search (city, abbreviation)')}
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
  const timeZoneGroups = useMemo(() => {
    const now = Date.now();
    const groups = new Map<string, SelectableZone[]>();

    const pushOption = (group: string, zone: TimeZone, info: TimeZoneOptionInfo, legacyName?: string) => {
      const label = getTimeZoneTitle(info);
      const options = groups.get(group) ?? [];

      // Filtering matches against the zone id, abbreviation, city label, and
      // the legacy spelling (e.g. Asia/Kolkata is also searchable as
      // "calcutta"). Country search is no longer supported.
      const searchIndex = [zone, info.abbreviation, label !== zone ? label : '', legacyName ?? '']
        .filter(Boolean)
        .join('|')
        .toLowerCase();

      options.push({ label, value: zone, info, searchIndex });
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
      pushOption('', zone, getInternalTimeZoneInfo(zone, now));
    }

    // Zones are presented under their canonical IANA id (e.g. Asia/Kolkata),
    // even when the runtime lists a legacy spelling (Chrome's ICU still
    // returns Asia/Calcutta). Intl accepts either spelling as input, so the
    // canonical id is safe to use as the option value everywhere.
    for (const tz of getCanonicalTimeZonesAt(now)) {
      const delimiter = tz.name.indexOf('/');
      const group = delimiter === -1 ? '' : tz.name.slice(0, delimiter);
      pushOption(group, tz.name, { name: tz.name, ianaName: tz.name, abbreviation: tz.abbr }, tz.legacyName);
    }

    return Array.from(groups, ([label, options]) => ({ label, options }));
  }, [includeInternal]);

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

    // Options are keyed by canonical IANA ids, but the incoming value may use
    // a legacy spelling (e.g. Asia/Calcutta persisted by an older Grafana or
    // returned by Chrome's Intl).
    const tz = canonicalZoneName(timeZone, Date.now()).toLowerCase();

    for (const group of groups) {
      const option = group.options.find((option) => option.value?.toLowerCase() === tz);

      if (option) {
        return option;
      }
    }

    return undefined;
  }, [groups, timeZone]);
};

const filterBySearchIndex = (option: SelectableValue, searchQuery: string) => {
  if (!searchQuery || !option.data || !option.data.searchIndex) {
    return true;
  }
  return option.data.searchIndex.indexOf(searchQuery.toLowerCase()) > -1;
};

const internalZoneNames: Record<string, string> = {
  [InternalTimeZones.default]: 'Default',
  [InternalTimeZones.localBrowserTime]: 'Browser Time',
  [InternalTimeZones.utc]: 'Coordinated Universal Time',
};

/**
 * Builds display info for Grafana's internal zones (Default, Browser, UTC).
 * The Default option inherits the resolved zone's abbreviation and offset,
 * so e.g. a UTC default shows 'UTC, GMT'.
 */
const getInternalTimeZoneInfo = (zone: TimeZone, timestamp: number): TimeZoneOptionInfo => {
  const ianaName = canonicalZoneName(resolveIanaName(zone), timestamp);

  return {
    name: internalZoneNames[zone] ?? zone,
    ianaName,
    // The runtime's zone list may not contain a plain UTC entry.
    abbreviation: ianaName === 'UTC' ? 'UTC, GMT' : (findTimeZoneAt(ianaName, timestamp)?.abbr ?? ''),
  };
};
