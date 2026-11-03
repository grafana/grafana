import { type TimeOption, type TimeRange, type TimeZone, rangeUtil, dateTimeFormat } from '@grafana/data';
import { t } from '@grafana/i18n';

/**
 * Takes a printable TimeOption and builds a TimeRange with DateTime properties from it
 */
export const mapOptionToTimeRange = (option: TimeOption, timeZone?: TimeZone): TimeRange => {
  return rangeUtil.convertRawToRange({ from: option.from, to: option.to }, timeZone);
};

/**
 * Takes a TimeRange and makes a printable TimeOption with formatted date strings correct for the timezone from it
 */
export const mapRangeToTimeOption = (range: TimeRange, timeZone?: TimeZone): TimeOption => {
  const from = dateTimeFormat(range.from, { timeZone });
  const to = dateTimeFormat(range.to, { timeZone });

  return {
    from,
    to,
    display: t('time-picker.range-picker.absolute-to-display', '{{from}} to {{to}}', { from, to }),
  };
};
