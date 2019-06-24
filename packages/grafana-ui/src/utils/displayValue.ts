// Libraries
import _ from 'lodash';

// Utils
import { getValueFormat } from './valueFormats/valueFormats';
import { getMappedValue } from './valueMappings';
import { getColorFromHexRgbOrName } from './namedColorsPalette';

// Types
import {
  Threshold,
  ValueMapping,
  DecimalInfo,
  DisplayValue,
  GrafanaTheme,
  GrafanaThemeType,
  DecimalCount,
  Field,
} from '../types';
import { DateTime, dateTime } from './moment_wrapper';

export type DisplayProcessor = (value: any) => DisplayValue;

export interface DisplayValueOptions {
  field?: Partial<Field>;

  mappings?: ValueMapping[];
  thresholds?: Threshold[];

  // Alternative to empty string
  noValue?: string;

  // Context
  isUtc?: boolean;
  theme?: GrafanaTheme; // Will pick 'dark' if not defined
}

export function getDisplayProcessor(options?: DisplayValueOptions): DisplayProcessor {
  if (options && !_.isEmpty(options)) {
    const field = options.field ? options.field : {};
    const formatFunc = getValueFormat(field.unit || 'none');

    return (value: any) => {
      const { mappings, thresholds, theme } = options;
      let color;

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

      if (field.dateFormat) {
        const date = toMoment(value, numeric, field.dateFormat);
        if (date.isValid()) {
          text = date.format(field.dateFormat);
          shouldFormat = false;
        }
      }

      if (!isNaN(numeric)) {
        if (shouldFormat && !_.isBoolean(value)) {
          const { decimals, scaledDecimals } = getDecimalsForValue(value, field.decimals);
          text = formatFunc(numeric, decimals, scaledDecimals, options.isUtc);
        }
        if (thresholds && thresholds.length) {
          color = getColorFromThreshold(numeric, thresholds, theme);
        }
      }

      if (!text) {
        text = options.noValue ? options.noValue : '';
      }
      return { text, numeric, color };
    };
  }

  return toStringProcessor;
}

function toMoment(value: any, numeric: number, format: string): DateTime {
  if (!isNaN(numeric)) {
    const v = dateTime(numeric);
    if (v.isValid()) {
      return v;
    }
  }
  const v = dateTime(value, format);
  if (v.isValid) {
    return v;
  }
  return dateTime(value); // moment will try to parse the format
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

export function getDecimalsForValue(value: number, decimalOverride?: DecimalCount): DecimalInfo {
  if (_.isNumber(decimalOverride)) {
    // It's important that scaledDecimals is null here
    return { decimals: decimalOverride, scaledDecimals: null };
  }

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
