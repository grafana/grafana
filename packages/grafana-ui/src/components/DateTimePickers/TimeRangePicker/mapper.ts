import { TimeOption, TimeRange, TimeZone, rangeUtil, dateTimeFormat } from '@grafana/data';

import { t } from '../../../utils/i18n';

export const mapOptionToTimeRange = (option: TimeOption, timeZone?: TimeZone): TimeRange => {
  return rangeUtil.convertRawToRange({ from: option.from, to: option.to }, timeZone);
};

export const mapRangeToTimeOption = (range: TimeRange, timeZone?: TimeZone): TimeOption => {
  const from = dateTimeFormat(range.from, { timeZone });
  const to = dateTimeFormat(range.to, { timeZone });

  return {
    from,
    to,
    // BMC Change: Next line : Localized the display string
    display: `${from} ${t('time-picker.range-picker.to', 'to')} ${to}`,
  };
};
