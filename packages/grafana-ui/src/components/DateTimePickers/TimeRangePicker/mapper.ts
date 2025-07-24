import { TimeOption, TimeRange, TimeZone, rangeUtil, dateTimeFormat } from '@grafana/data';
import { formatDateRange } from '@grafana/i18n';

import { getFeatureToggle } from '../../../utils/featureToggle';
import { commonFormat } from '../commonFormat';
export const mapOptionToTimeRange = (option: TimeOption, timeZone?: TimeZone): TimeRange => {
  return rangeUtil.convertRawToRange({ from: option.from, to: option.to }, timeZone, undefined, commonFormat);
};

// TODO: Should we keep these format presets somewhere common?
const rangeFormatShort: Intl.DateTimeFormatOptions = {
  dateStyle: 'short',
  timeStyle: 'short',
};

const rangeFormatFull: Intl.DateTimeFormatOptions = {
  dateStyle: 'short',
  timeStyle: 'medium',
};

export const mapRangeToTimeOption = (range: TimeRange, timeZone?: TimeZone): TimeOption => {
  const from = dateTimeFormat(range.from, { timeZone, format: commonFormat });
  const to = dateTimeFormat(range.to, { timeZone, format: commonFormat });

  let display = `${from} to ${to}`;

  if (getFeatureToggle('localeFormatPreference')) {
    const fromDate = range.from.toDate();
    const toDate = range.to.toDate();

    // The short time format doesn't include seconds, so change the format
    // if the range includes seconds
    const hasSeconds = fromDate.getSeconds() !== 0 || toDate.getSeconds() !== 0;
    display = formatDateRange(fromDate, toDate, hasSeconds ? rangeFormatFull : rangeFormatShort);
  }

  return {
    from,
    to,
    display,
  };
};
