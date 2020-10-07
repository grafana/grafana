// Libraries
import _ from 'lodash';

// Types
import { Field, FieldType } from '../types/dataFrame';
import { GrafanaTheme, GrafanaThemeType } from '../types/theme';
import { DecimalCount, DecimalInfo, DisplayProcessor, DisplayValue } from '../types/displayValue';
import { getValueFormat } from '../valueFormats/valueFormats';
import { getMappedValue } from '../utils/valueMappings';
import { dateTime } from '../datetime';
import { KeyValue, TimeZone } from '../types';
import { getScaleCalculator } from './scale';

interface DisplayProcessorOptions {
  field: Partial<Field>;
  /**
   * Will pick browser timezone if not defined
   */
  timeZone?: TimeZone;
  /**
   * Will pick 'dark' if not defined
   */
  theme?: GrafanaTheme;
}

// Reasonable units for time
const timeFormats: KeyValue<boolean> = {
  dateTimeAsIso: true,
  dateTimeAsIsoSmart: true,
  dateTimeAsUS: true,
  dateTimeAsUSSmart: true,
  dateTimeFromNow: true,
};

export function getDisplayProcessor(options?: DisplayProcessorOptions): DisplayProcessor {
  if (!options || _.isEmpty(options) || !options.field) {
    return toStringProcessor;
  }

  const { field } = options;
  const config = field.config ?? {};

  // Theme should be required or we need access to default theme instance from here
  const theme = options.theme ?? ({ type: GrafanaThemeType.Dark } as GrafanaTheme);

  let unit = config.unit;
  let hasDateUnit = unit && (timeFormats[unit] || unit.startsWith('time:'));

  if (field.type === FieldType.time && !hasDateUnit) {
    unit = `dateTimeAsSystem`;
    hasDateUnit = true;
  }

  const formatFunc = getValueFormat(unit || 'none');
  const scaleFunc = getScaleCalculator(field as Field, theme);

  return (value: any) => {
    const { mappings } = config;
    const isStringUnit = unit === 'string';

    if (hasDateUnit && typeof value === 'string') {
      value = dateTime(value).valueOf();
    }

    let text = _.toString(value);
    let numeric = isStringUnit ? NaN : toNumber(value);
    let prefix: string | undefined = undefined;
    let suffix: string | undefined = undefined;
    let shouldFormat = true;

    if (mappings && mappings.length > 0) {
      const mappedValue = getMappedValue(mappings, value);

      if (mappedValue) {
        text = mappedValue.text;
        const v = isStringUnit ? NaN : toNumber(text);

        if (!isNaN(v)) {
          numeric = v;
        }

        shouldFormat = false;
      }
    }

    if (!isNaN(numeric)) {
      if (shouldFormat && !_.isBoolean(value)) {
        const { decimals, scaledDecimals } = getDecimalsForValue(value, config.decimals);
        const v = formatFunc(numeric, decimals, scaledDecimals, options.timeZone);
        text = v.text;
        suffix = v.suffix;
        prefix = v.prefix;

        // Check if the formatted text mapped to a different value
        if (mappings && mappings.length > 0) {
          const mappedValue = getMappedValue(mappings, text);
          if (mappedValue) {
            text = mappedValue.text;
          }
        }
      }

      // Return the value along with scale info
      if (text) {
        return { text, numeric, prefix, suffix, ...scaleFunc(numeric) };
      }
    }

    if (!text) {
      if (config.noValue) {
        text = config.noValue;
      } else {
        text = ''; // No data?
      }
    }

    return { text, numeric, prefix, suffix, ...scaleFunc(0) };
  };
}

/** Will return any value as a number or NaN */
function toNumber(value: any): number {
  if (typeof value === 'number') {
    return value;
  }
  if (value === '' || value === null || value === undefined || Array.isArray(value)) {
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

export function getDecimalsForValue(value: number, decimalOverride?: DecimalCount): DecimalInfo {
  if (_.isNumber(decimalOverride)) {
    // It's important that scaledDecimals is null here
    return { decimals: decimalOverride, scaledDecimals: null };
  }

  let dec = -Math.floor(Math.log(value) / Math.LN10) + 1;
  const magn = Math.pow(10, -dec);
  const norm = value / magn; // norm is between 1.0 and 10.0
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
  if (value % 1 === 0) {
    dec = 0;
  }

  const decimals = Math.max(0, dec);
  const scaledDecimals = decimals - Math.floor(Math.log(size) / Math.LN10) + 2;

  return { decimals, scaledDecimals };
}

export function getRawDisplayProcessor(): DisplayProcessor {
  return (value: any) => ({
    text: `${value}`,
    numeric: (null as unknown) as number,
  });
}
