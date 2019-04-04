// Libraries
import _ from 'lodash';
import moment from 'moment';

// Utils
import { getValueFormat } from './valueFormats/valueFormats';
import { getMappedValue } from './valueMappings';
import { getColorFromHexRgbOrName } from './namedColorsPalette';

// Types
import { Threshold, ValueMapping, DecimalInfo, DisplayValue, GrafanaTheme, GrafanaThemeType } from '../types';
import { DecimalCount } from './valueFormats/valueFormats';

export type DisplayProcessor = (value: any) => DisplayValue;

export interface DisplayValueOptions {
  unit?: string;
  decimals?: DecimalCount;
  dateFormat?: string; // If set try to convert numbers to date

  color?: string;
  mappings?: ValueMapping[];
  thresholds?: Threshold[];
  prefix?: string;
  suffix?: string;

  // Alternative to empty string
  noValue?: string;

  // Context
  isUtc?: boolean;
  theme?: GrafanaTheme; // Will pick 'dark' if not defined
}

export function getDisplayProcessor(options?: DisplayValueOptions): DisplayProcessor {
  if (options && !_.isEmpty(options)) {
    const formatFunc = getValueFormat(options.unit || 'none');

    return (value: any) => {
      const { prefix, suffix, mappings, thresholds, theme } = options;
      let color = options.color;

      let text = _.toString(value);
      let numeric = toNumber(value);

      let shouldFormat = true;
      if (mappings && mappings.length > 0) {
        const mappedValue = getMappedValue(mappings, value);

        if (mappedValue) {
          text = mappedValue.text;
          const v = toNumber(text);

          if (!isNaN(v)) {
            numeric = v;
          }

          shouldFormat = false;
        }
      }

      if (options.dateFormat) {
        const date = toMoment(value, numeric, options.dateFormat);
        if (date.isValid()) {
          text = date.format(options.dateFormat);
          shouldFormat = false;
        }
      }

      if (!isNaN(numeric)) {
        if (shouldFormat && !_.isBoolean(value)) {
          let decimals;
          let scaledDecimals = 0;

          if (!options.decimals) {
            const decimalInfo = getDecimalsForValue(value);

            decimals = decimalInfo.decimals;
            scaledDecimals = decimalInfo.scaledDecimals;
          } else {
            decimals = options.decimals;
          }

          text = formatFunc(numeric, decimals, scaledDecimals, options.isUtc);
        }
        if (thresholds && thresholds.length > 0) {
          color = getColorFromThreshold(numeric, thresholds, theme);
        }
      }

      if (!text) {
        text = options.noValue ? options.noValue : '';
      }
      if (prefix) {
        text = prefix + text;
      }
      if (suffix) {
        text = text + suffix;
      }
      return { text, numeric, color };
    };
  }

  return toStringProcessor;
}

function toMoment(value: any, numeric: number, format: string): moment.Moment {
  if (!isNaN(numeric)) {
    const v = moment(numeric);
    if (v.isValid()) {
      return v;
    }
  }
  const v = moment(value, format);
  if (v.isValid) {
    return v;
  }
  return moment(value); // moment will try to parse the format
}

/** Will return any value as a number or NaN */
function toNumber(value: any): number {
  if (typeof value === 'number') {
    return value;
  }
  if (value === null || value === undefined || Array.isArray(value)) {
    return NaN; // lodash calls them 0
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return _.toNumber(value);
}

function toStringProcessor(value: any): DisplayValue {
  return { text: _.toString(value), numeric: toNumber(value) };
}

export function getColorFromThreshold(value: number, thresholds: Threshold[], theme?: GrafanaTheme): string {
  const themeType = theme ? theme.type : GrafanaThemeType.Dark;

  if (thresholds.length === 1) {
    return getColorFromHexRgbOrName(thresholds[0].color, themeType);
  }

  const atThreshold = thresholds.filter(threshold => value === threshold.value)[0];
  if (atThreshold) {
    return getColorFromHexRgbOrName(atThreshold.color, themeType);
  }

  const belowThreshold = thresholds.filter(threshold => value > threshold.value);

  if (belowThreshold.length > 0) {
    const nearestThreshold = belowThreshold.sort((t1, t2) => t2.value - t1.value)[0];
    return getColorFromHexRgbOrName(nearestThreshold.color, themeType);
  }

  // Use the first threshold as the default color
  return getColorFromHexRgbOrName(thresholds[0].color, themeType);
}

export function getDecimalsForValue(value: number): DecimalInfo {
  const delta = value / 2;
  let dec = -Math.floor(Math.log(delta) / Math.LN10);

  const magn = Math.pow(10, -dec);
  const norm = delta / magn; // norm is between 1.0 and 10.0
  let size;

  if (norm < 1.5) {
    size = 1;
  } else if (norm < 3) {
    size = 2;
    // special case for 2.5, requires an extra decimal
    if (norm > 2.25) {
      size = 2.5;
      ++dec;
    }
  } else if (norm < 7.5) {
    size = 5;
  } else {
    size = 10;
  }

  size *= magn;

  // reduce starting decimals if not needed
  if (Math.floor(value) === value) {
    dec = 0;
  }

  const decimals = Math.max(0, dec);
  const scaledDecimals = decimals - Math.floor(Math.log(size) / Math.LN10) + 2;

  return { decimals, scaledDecimals };
}
