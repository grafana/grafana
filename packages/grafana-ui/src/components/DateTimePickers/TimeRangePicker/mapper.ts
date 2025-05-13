import { TimeOption, TimeRange, TimeZone, rangeUtil, dateTimeFormat } from '@grafana/data';
import { formatDate } from '@grafana/i18n';

import { getFeatureToggle } from '../../../utils/featureToggle';
export const mapOptionToTimeRange = (option: TimeOption, timeZone?: TimeZone): TimeRange => {
  return rangeUtil.convertRawToRange({ from: option.from, to: option.to }, timeZone);
};

export const mapRangeToTimeOption = (range: TimeRange, timeZone?: TimeZone): TimeOption => {
  const from = dateTimeFormat(range.from, { timeZone });
  const to = dateTimeFormat(range.to, { timeZone });
  const display = `${from} to ${to}`;
  const formatOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };
  const isLocaleToggleEnabled = getFeatureToggle('localeFormatPreference');
  const displayFrom = formatDate(range.from.toDate(), formatOptions);
  const displayTo = formatDate(range.to.toDate(), formatOptions);
  const displayRegionLocale = `${displayFrom} - ${displayTo}`;

  return {
    from,
    to,
    display: isLocaleToggleEnabled ? displayRegionLocale : display,
  };
};
