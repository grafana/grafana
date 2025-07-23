import { TimeOption, TimeRange, TimeZone, rangeUtil, dateTimeFormat } from '@grafana/data';

import { getFeatureToggle } from '../../../utils/featureToggle';
import { commonFormat } from '../commonFormat';

export const mapOptionToTimeRange = (option: TimeOption, timeZone?: TimeZone): TimeRange => {
  return rangeUtil.convertRawToRange({ from: option.from, to: option.to }, timeZone, undefined, commonFormat);
};

export const mapRangeToTimeOption = (range: TimeRange, timeZone?: TimeZone): TimeOption => {
  const from = dateTimeFormat(range.from, { timeZone, format: commonFormat });
  const to = dateTimeFormat(range.to, { timeZone, format: commonFormat });

  let display = `${from} to ${to}`;

  if (getFeatureToggle('localeFormatPreference')) {
    display = rangeUtil.describeTimeRange(range, timeZone);
  }

  return {
    from,
    to,
    display,
  };
};
