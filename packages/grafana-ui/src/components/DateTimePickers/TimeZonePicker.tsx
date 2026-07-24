import { useMemo, useCallback } from 'react';

import { type SelectableValue, type TimeZone, InternalTimeZones } from '@grafana/data';
import { canonicalZoneName, getTimeZonesAt } from '@grafana/data/unstable';
import { t } from '@grafana/i18n';

import { Select } from '../Select/Select';

import { TimeZoneGroup } from './TimeZonePicker/TimeZoneGroup';
import { CompactTimeZoneOption, WideTimeZoneOption, type SelectableZone } from './TimeZonePicker/TimeZoneOption';
import { getTimeZoneTitle } from './TimeZonePicker/TimeZoneTitle';
import { getTimeZoneDisplayInfo, type TimeZoneDisplayInfo } from './TimeZonePicker/timeZoneUtils';

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

    const pushOption = (group: string, zone: TimeZone, info: TimeZoneDisplayInfo, legacyName?: string) => {
      const label = getTimeZoneTitle(info);
      const options = groups.get(group) ?? [];

      // Filtering matches against the zone id, abbreviation, city label, and
      // the legacy spelling (e.g. Asia/Kolkata is also searchable as
      // "calcutta"). Country search is no longer supported.
      const searchIndex = [zone, info.abbreviation, label !== zone ? label : '', legacyName]
        .filter(Boolean)
        .join('|')
        .toLowerCase();

      options.push({ label, value: zone, info, searchIndex });
      groups.set(group, options);
    };

    // Internal zones (Default, Browser, UTC) go into a leading, label-less
    // group so they render at the top of the menu.
    const internalZones: TimeZone[] = Array.isArray(includeInternal)
      ? includeInternal
      : includeInternal
        ? [InternalTimeZones.default, InternalTimeZones.localBrowserTime, InternalTimeZones.utc]
        : [];

    for (const zone of internalZones) {
      const info = getTimeZoneDisplayInfo(zone, now);

      if (info) {
        pushOption('', zone, info);
      }
    }

    const zones = getTimeZonesAt(now);

    // Legacy spelling entries are skipped as options below, but make the
    // canonical option searchable under the legacy name too (e.g.
    // Asia/Kolkata is also searchable as "calcutta").
    const legacyNames = new Map<string, string>();

    for (const tz of zones) {
      if (tz.aliasOf !== undefined) {
        legacyNames.set(tz.aliasOf, tz.name);
      }
    }

    for (const tz of zones) {
      if (tz.aliasOf !== undefined) {
        continue;
      }

      const delimiter = tz.name.indexOf('/');
      const group = delimiter === -1 ? '' : tz.name.slice(0, delimiter);
      pushOption(group, tz.name, { name: tz.name, abbreviation: tz.abbr, offset: tz.offset }, legacyNames.get(tz.name));
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
