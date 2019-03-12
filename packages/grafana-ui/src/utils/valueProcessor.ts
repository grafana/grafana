import { ValueMapping, Threshold } from '../types/panel';
import _ from 'lodash';
import { getValueFormat, DecimalCount } from './valueFormats/valueFormats';
import { getMappedValue } from './valueMappings';
import { GrafanaTheme, GrafanaThemeType } from '../types/theme';
import { getColorFromHexRgbOrName } from './namedColorsPalette';

export interface DisplayValue {
  text: string; // How the value should be displayed
  numeric: number; // Use isNaN to check if it actually is a number
  color?: string; // suggested color
}

export interface DisplayValueOptions {
  unit?: string;
  decimals?: DecimalCount;
  scaledDecimals?: DecimalCount;
  isUtc?: boolean;

  color?: string;
  mappings?: ValueMapping[];
  thresholds?: Threshold[];
  prefix?: string;
  suffix?: string;

  noValue?: string;
  theme?: GrafanaTheme; // Will pick 'dark' if not defined
}

export type ValueProcessor = (value: any) => DisplayValue;

export function getValueProcessor(options?: DisplayValueOptions): ValueProcessor {
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

      if (!isNaN(numeric)) {
        if (shouldFormat) {
          text = formatFunc(numeric, options.decimals, options.scaledDecimals, options.isUtc);
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
